package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Constanten uit KESY DDL / UUID Specificaties
const (
	RelIDVerzamelingKoppeling = "019fcdd3-721a-7512-b755-cddd67f43eb6"
	RelIDMediaKoppeling       = "019fc28b-e55e-7303-8178-efba6993a77b"
	ObjTypeVerzamelingMedia   = "01a01ad3-e233-73fd-a0cc-e07f887b2b8d"
	ObjTypeFoto               = "01a016cd-9042-776b-a161-40c1ead8826b"
	ObjTypeVideo              = "01a016cd-906f-733b-9c7d-88f7cde6068f"
	ParamIDAfbeelding         = "01a0108f-3880-752d-b961-9e50e167028d"
	ParamIDMetadata           = "01a01e97-7b40-74bf-ac37-1af9fbebf4d1"
)

type MediaMetadataJSON struct {
	Opnamedatum           string `json:"opnamedatum"`
	OorspronkelijkFormaat string `json:"oorspronkelijkFormaat"`
	Latitude              string `json:"latitude"`
	Longitude             string `json:"longitude"`
	Device                string `json:"device"`
}

type MediaImportItem struct {
	OriginalPath    string            `json:"originalPath"`
	FileName        string            `json:"fileName"`
	MediaType       string            `json:"mediaType"`       // "FOTO" of "VIDEO"
	DestinationPath string            `json:"destinationPath"` // bijv: 2005/W17/20050425_104800_foto.jpg
	HasExactDate    bool              `json:"hasExactDate"`    // false = datum is overgenomen van vorig bestand
	Metadata        MediaMetadataJSON `json:"metadata"`
}

// SelectDirectory opent een native Windows mappenkiezer
func (a *App) SelectDirectory() (string, error) {
	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecteer de map met media (foto's/video's)",
	})
	if err != nil {
		return "", err
	}
	return selection, nil
}

// Helper om logberichten naar de frontend te sturen
func (a *App) logToUI(level string, message string) {
	runtime.EventsEmit(a.ctx, "media-import-log", map[string]string{
		"level":   level, // "INFO", "WARN", "ERROR", "SUCCESS"
		"message": message,
	})
}

// ScanMediaDirectory scant een map, converteert HEIC indien nodig, leest EXIF/metadata en genereert bestemmingspaden
func (a *App) ScanMediaDirectory(dirPath string) ([]MediaImportItem, error) {
	a.logToUI("INFO", fmt.Sprintf("Starten met scannen van map: %s", dirPath))

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		a.logToUI("ERROR", fmt.Sprintf("Kan map niet lezen: %v", err))
		return nil, fmt.Errorf("fout bij lezen map: %w", err)
	}

	a.logToUI("INFO", fmt.Sprintf("%d bestanden/mappen gevonden", len(entries)))

	var items []MediaImportItem
	var lastValidTime time.Time
	hasPreviousTime := false

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		ext := strings.ToLower(filepath.Ext(entry.Name()))
		fullPath := filepath.Join(dirPath, entry.Name())
		originalExt := ext

		// HEIC conversie log
		if ext == ".heic" {
			a.logToUI("INFO", fmt.Sprintf("HEIC bestand gedetecteerd: %s, conversie starten...", entry.Name()))
			jpgPath := strings.TrimSuffix(fullPath, filepath.Ext(fullPath)) + ".jpg"
			if err := convertHeicToJpg(fullPath, jpgPath); err == nil {
				fullPath = jpgPath
				ext = ".jpg"
				a.logToUI("SUCCESS", fmt.Sprintf("HEIC succesvol omgezet naar JPG met EXIF: %s", filepath.Base(jpgPath)))
			} else {
				a.logToUI("ERROR", fmt.Sprintf("HEIC conversie mislukt voor %s: %v", entry.Name(), err))
			}
		}

		if !isSupportedMedia(ext) {
			a.logToUI("WARN", fmt.Sprintf("Niet-ondersteund bestand overgeslagen: %s", entry.Name()))
			continue
		}

		mediaType := "FOTO"
		if isVideoExt(ext) {
			mediaType = "VIDEO"
		}

		// Metadata extractie op het (geconverteerde) bestand
		meta, recordTime, exact := a.extractMetadata(fullPath, originalExt)

		if exact {
			lastValidTime = recordTime
			hasPreviousTime = true
			a.logToUI("INFO", fmt.Sprintf("EXIF/Metadata datum gevonden voor %s: %s", entry.Name(), recordTime.Format("2006-01-02 15:04:05")))
		} else if hasPreviousTime {
			recordTime = lastValidTime
			meta.Opnamedatum = recordTime.Format("2006-01-02T15:04:05.0000000Z")
			a.logToUI("WARN", fmt.Sprintf("Geen EXIF/Metadata voor %s. Datum overgenomen van vorig bestand: %s", entry.Name(), recordTime.Format("2006-01-02 15:04:05")))
		} else {
			recordTime = time.Now()
			meta.Opnamedatum = recordTime.Format("2006-01-02T15:04:05.0000000Z")
			a.logToUI("WARN", fmt.Sprintf("Geen EXIF/Metadata voor %s. Huidige datum gebruikt.", entry.Name()))
		}

		year, week := recordTime.ISOWeek()
		destFilename := fmt.Sprintf("%s_%s", recordTime.Format("20060102_150405"), filepath.Base(fullPath))
		relPath := fmt.Sprintf("%d/W%02d/%s", year, week, destFilename)

		items = append(items, MediaImportItem{
			OriginalPath:    fullPath,
			FileName:        entry.Name(),
			MediaType:       mediaType,
			DestinationPath: relPath,
			HasExactDate:    exact,
			Metadata:        meta,
		})
	}

	a.logToUI("SUCCESS", fmt.Sprintf("Scannen voltooid! %d ondersteunde bestanden verwerkt.", len(items)))
	return items, nil
}

// ExecuteMediaImport voert de definitieve DB-transactie uit en verplaatst bestanden
func (a *App) ExecuteMediaImport(groupName string, items []MediaImportItem) error {
	if a.db == nil {
		return fmt.Errorf("database niet verbonden")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)

	// 1. Controleer of Groepsobject al bestaat (case-insensitive)
	var groupObjectID string
	err = tx.QueryRow(`
		SELECT o.id FROM objects o
		JOIN relation_values rv ON rv.target_id = o.id
		WHERE LOWER(o.label) = LOWER(?) 
		  AND rv.relation_id = ? 
		  AND rv.source_id = ?
		  AND o.deleted_at IS NULL LIMIT 1`,
		groupName, RelIDVerzamelingKoppeling, ObjTypeVerzamelingMedia).Scan(&groupObjectID)

	if err == sql.ErrNoRows {
		// Maak nieuw Verzameling Groepsobject aan
		groupObjectID = NewUUIDv7()
		_, err = tx.Exec(`INSERT INTO objects (id, label, is_confidential, valid_from, updated_at) VALUES (?, ?, 0, ?, ?)`,
			groupObjectID, groupName, now, now)
		if err != nil {
			return fmt.Errorf("fout bij aanmaken groepsobject: %w", err)
		}

		// Koppel aan Verzameling Media Type
		relID := NewUUIDv7()
		_, err = tx.Exec(`INSERT INTO relation_values (id, relation_id, source_id, target_id, is_confidential, valid_from, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
			relID, RelIDVerzamelingKoppeling, ObjTypeVerzamelingMedia, groupObjectID, now, now)
		if err != nil {
			return fmt.Errorf("fout bij koppelen groep aan type: %w", err)
		}
	} else if err != nil {
		return err
	}

	// Bepaal basismap relatief t.o.v. de .exe
	exePath, _ := os.Executable()
	baseMediaDir := filepath.Join(filepath.Dir(exePath), "..", "Media")

	// 2. Verwerk items
	for _, item := range items {
		cleanRelPath := filepath.ToSlash(item.DestinationPath)

		// Check of bestand al bestaat in DB
		var mediaObjectID string
		err := tx.QueryRow(`
			SELECT target_id FROM parameter_values 
			WHERE parameter_id = ? AND value = ? AND deleted_at IS NULL LIMIT 1`,
			ParamIDAfbeelding, cleanRelPath).Scan(&mediaObjectID)

		if err == sql.ErrNoRows {
			// Nieuw Media Object
			mediaObjectID = NewUUIDv7()
			objTypeID := ObjTypeFoto
			if item.MediaType == "VIDEO" {
				objTypeID = ObjTypeVideo
			}

			label := fmt.Sprintf("%s: %s", item.MediaType, cleanRelPath)
			_, err = tx.Exec(`INSERT INTO objects (id, label, is_confidential, valid_from, updated_at) VALUES (?, ?, 0, ?, ?)`,
				mediaObjectID, label, now, now)
			if err != nil {
				return err
			}

			// Koppel aan Foto/Video type
			_, err = tx.Exec(`INSERT INTO relation_values (id, relation_id, source_id, target_id, is_confidential, valid_from, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
				NewUUIDv7(), RelIDMediaKoppeling, objTypeID, mediaObjectID, now, now)
			if err != nil {
				return err
			}

			// Parameter: afbeelding
			_, err = tx.Exec(`INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, is_confidential, valid_from, updated_at) VALUES (?, ?, ?, 'object', ?, 0, ?, ?)`,
				NewUUIDv7(), ParamIDAfbeelding, mediaObjectID, cleanRelPath, now, now)
			if err != nil {
				return err
			}

			// Parameter: METAdata
			metaBytes, _ := json.Marshal(item.Metadata)
			_, err = tx.Exec(`INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, is_confidential, valid_from, updated_at) VALUES (?, ?, ?, 'object', ?, 0, ?, ?)`,
				NewUUIDv7(), ParamIDMetadata, mediaObjectID, string(metaBytes), now, now)
			if err != nil {
				return err
			}
		}

		// Koppel media object aan groepsobject (Aangepast: Media Object = Source, Groepsobject = Target)
		_, err = tx.Exec(`INSERT INTO relation_values (id, relation_id, source_id, target_id, is_confidential, valid_from, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
			NewUUIDv7(), RelIDMediaKoppeling, mediaObjectID, groupObjectID, now, now)
		if err != nil {
			return err
		}

		// 3. Verplaats het fysieke bestand
		destFullPath := filepath.Join(baseMediaDir, filepath.FromSlash(cleanRelPath))
		if err := os.MkdirAll(filepath.Dir(destFullPath), 0755); err != nil {
			return fmt.Errorf("kan map niet aanmaken: %w", err)
		}
		if err := moveFile(item.OriginalPath, destFullPath); err != nil {
			return fmt.Errorf("fout bij verplaatsen bestand: %w", err)
		}
	}

	return tx.Commit()
}

// Helper functies
func isSupportedMedia(ext string) bool {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".mov", ".avi", ".mkv":
		return true
	default:
		return false
	}
}

func isVideoExt(ext string) bool {
	switch ext {
	case ".mp4", ".mov", ".avi", ".mkv":
		return true
	default:
		return false
	}
}

// Fallback: extraheert datum uit bestandsnaam zoals 20240122_14.09.48_... of 20240122_140948_...
func extractDateFromFileName(filename string) (time.Time, bool) {
	re := regexp.MustCompile(`(\d{4})(\d{2})(\d{2})_(\d{2})[\.:]?(\d{2})[\.:]?(\d{2})`)
	matches := re.FindStringSubmatch(filename)
	if len(matches) == 7 {
		layout := "2006-01-02 15:04:05"
		dateStr := fmt.Sprintf("%s-%s-%s %s:%s:%s", matches[1], matches[2], matches[3], matches[4], matches[5], matches[6])
		t, err := time.Parse(layout, dateStr)
		if err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func (a *App) extractMetadata(path string, origExt string) (MediaMetadataJSON, time.Time, bool) {
	meta := MediaMetadataJSON{
		OorspronkelijkFormaat: origExt,
		Latitude:              "not available",
		Longitude:             "not available",
		Device:                "unknown",
	}

	ext := strings.ToLower(origExt)
	if ext == "" {
		ext = strings.ToLower(filepath.Ext(path))
	}

	// 1. Als het een video is, direct via ffprobe
	if isVideoExt(ext) || ext == ".mov" {
		return a.extractVideoMetadata(path, meta)
	}

	// 2. Probeer goexif voor foto's
	f, err := os.Open(path)
	if err == nil {
		x, errDecode := exif.Decode(f)
		f.Close()

		if errDecode == nil {
			tm, errDate := x.DateTime()
			if errDate == nil {
				meta.Opnamedatum = tm.Format("2006-01-02T15:04:05.0000000Z")

				if cam, err := x.Get(exif.Model); err == nil {
					meta.Device, _ = cam.StringVal()
				}
				if lat, long, err := x.LatLong(); err == nil {
					meta.Latitude = fmt.Sprintf("%f", lat)
					meta.Longitude = fmt.Sprintf("%f", long)
				}

				return meta, tm, true
			}
		}
	}

	// 3. Fallback voor foto's waar goexif de Apple-header mist: gebruik ffprobe
	if metaProbe, tm, ok := a.extractVideoMetadata(path, meta); ok {
		return metaProbe, tm, true
	}

	// 4. Als EXIF ontbreekt of onleesbaar is
	return a.fallbackMetadata(path, meta)
}
func (a *App) fallbackMetadata(path string, meta MediaMetadataJSON) (MediaMetadataJSON, time.Time, bool) {
	// 1. Probeer datum uit bestandsnaam te halen
	if fileDate, ok := extractDateFromFileName(filepath.Base(path)); ok {
		meta.Opnamedatum = fileDate.Format("2006-01-02T15:04:05.0000000Z")
		return meta, fileDate, true
	}

	// 2. Als de bestandsnaam geen datum bevat, pak de bestandseigenschap op schijf (ModTime)
	fi, err := os.Stat(path)
	if err == nil {
		modTime := fi.ModTime()
		meta.Opnamedatum = modTime.Format("2006-01-02T15:04:05.0000000Z")
		return meta, modTime, false
	}

	// 3. Uiterste fallback
	now := time.Now()
	meta.Opnamedatum = now.Format("2006-01-02T15:04:05.0000000Z")
	return meta, now, false
}
func moveFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	in.Close()
	return os.Remove(src)
}

func convertHeicToJpg(src, dst string) error {
	toolPath := getToolPath("heif-dec.exe")

	if _, err := os.Stat(toolPath); os.IsNotExist(err) {
		return fmt.Errorf("heif-dec.exe niet gevonden op locatie: %s", toolPath)
	}

	cmd := exec.Command(toolPath, "-q", "100", src, dst)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("heif-dec conversie fout: %v - %s", err, string(output))
	}

	if _, err := os.Stat(dst); os.IsNotExist(err) {
		return fmt.Errorf("heif-dec voltooid, maar geconverteerd bestand %s is niet aangemaakt", dst)
	}

	return nil
}

func getToolPath(toolName string) string {
	exePath, err := os.Executable()
	if err != nil {
		return filepath.Join("portable_magick", toolName)
	}

	appDir := filepath.Dir(exePath)
	return filepath.Join(appDir, "portable_magick", toolName)
}

// extractVideoMetadata leest metadata uit MOV/MP4 en foto's via ffprobe (ondersteunt Apple QuickTime tags)
func (a *App) extractVideoMetadata(path string, meta MediaMetadataJSON) (MediaMetadataJSON, time.Time, bool) {
	ffprobePath := getToolPath("ffprobe.exe")
	if _, err := os.Stat(ffprobePath); os.IsNotExist(err) {
		return a.fallbackMetadata(path, meta)
	}

	cmd := exec.Command(ffprobePath,
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		path,
	)

	output, err := cmd.Output()
	if err != nil {
		return a.fallbackMetadata(path, meta)
	}

	var rawData struct {
		Format struct {
			Tags map[string]interface{} `json:"tags"`
		} `json:"format"`
		Streams []struct {
			Tags map[string]interface{} `json:"tags"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(output, &rawData); err != nil {
		return a.fallbackMetadata(path, meta)
	}

	var candidates []string

	collectTagValues := func(tags map[string]interface{}) {
		for key, val := range tags {
			k := strings.ToLower(key)
			if strVal, ok := val.(string); ok && strVal != "" {
				if strings.Contains(k, "date") || strings.Contains(k, "creation") || strings.Contains(k, "time") {
					candidates = append(candidates, strVal)
				}
				if strings.Contains(k, "model") {
					meta.Device = strVal
				}
				if strings.Contains(k, "location") {
					meta.Latitude = strVal
				}
			}
		}
	}

	if rawData.Format.Tags != nil {
		collectTagValues(rawData.Format.Tags)
	}

	for _, stream := range rawData.Streams {
		if stream.Tags != nil {
			collectTagValues(stream.Tags)
		}
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05-0700",
		"2006-01-02T15:04:05+0700",
		"2006-01-02T15:04:05+07:00",
		"2006-01-02T15:04:05-07:00",
		"2006-01-02T15:04:05.000000Z",
		"2006-01-02T15:04:05.000Z",
		"2006:01:02 15:04:05",
		"2006-01-02 15:04:05",
	}

	for _, dateStr := range candidates {
		cleanDateStr := strings.TrimSpace(dateStr)

		for _, layout := range layouts {
			if t, err := time.Parse(layout, cleanDateStr); err == nil {
				meta.Opnamedatum = t.Format("2006-01-02T15:04:05.0000000Z")
				return meta, t, true
			}
		}
	}

	return a.fallbackMetadata(path, meta)
}