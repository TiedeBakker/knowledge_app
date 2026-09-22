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

	"github.com/google/uuid"
	"github.com/rwcarlsen/goexif/exif"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Constanten / Hardcoded UUID's volgens afspraak
const (
	RelIDVerzamelingKoppeling = "019fcdd3-721a-7512-b755-cddd67f43eb6"
	RelIDMediaKoppeling       = "019fc28b-e55e-7303-8178-efba6993a77b"
	ParamIDAfbeelding         = "01a0108f-3880-752d-b961-9e50e167028d"
	ParamIDMetadata           = "01a01e97-7b40-74bf-ac37-1af9fbebf4d1"

	// Object-ID's voor types
	ObjectTypeFotoID  = "01a016cd-9042-776b-a161-40c1ead8826b"
	ObjectTypeVideoID = "01a016cd-906f-733b-9c7d-88f7cde6068f"
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
	DestinationPath string            `json:"destinationPath"` // YYYY/Wxx/YYYYMMDD_hhmmss_bestandsnaam
	HasExactDate    bool              `json:"hasExactDate"`
	Metadata        MediaMetadataJSON `json:"metadata"`
}

type ObjectSelectItem struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

func (a *App) SelectDirectory() (string, error) {
	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecteer de map met media (foto's/video's)",
	})
	if err != nil {
		return "", err
	}
	return selection, nil
}

func (a *App) logToUI(level string, message string) {
	runtime.EventsEmit(a.ctx, "media-import-log", map[string]string{
		"level":   level,
		"message": message,
	})
}

func (a *App) ScanMediaDirectory(dirPath string) ([]MediaImportItem, error) {
	a.logToUI("INFO", fmt.Sprintf("Starten met scannen van map: %s", dirPath))

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		a.logToUI("ERROR", fmt.Sprintf("Kan map niet lezen: %v", err))
		return nil, fmt.Errorf("fout bij lezen map: %w", err)
	}

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

		// 1. HEIC Conversie
		if ext == ".heic" {
			a.logToUI("INFO", fmt.Sprintf("HEIC bestand gedetecteerd: %s, conversie starten...", entry.Name()))
			jpgPath := strings.TrimSuffix(fullPath, filepath.Ext(fullPath)) + ".jpg"
			if err := convertHeicToJpg(fullPath, jpgPath); err == nil {
				fullPath = jpgPath
				ext = ".jpg"
				a.logToUI("SUCCESS", fmt.Sprintf("HEIC succesvol omgezet naar JPG: %s", filepath.Base(jpgPath)))
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

		meta, recordTime, exact := a.extractMetadata(fullPath, originalExt)

		if exact {
			lastValidTime = recordTime
			hasPreviousTime = true
		} else if hasPreviousTime {
			recordTime = lastValidTime
			meta.Opnamedatum = recordTime.Format("2006-01-02T15:04:05.0000000Z")
		} else {
			recordTime = time.Now()
			meta.Opnamedatum = recordTime.Format("2006-01-02T15:04:05.0000000Z")
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

// ReindexOutgoingRelations herberekent 'volgorde' in relation_values
func (a *App) ReindexOutgoingRelations(sourceObjectID string) (int, error) {
	var count, maxVal int
	checkQuery := `
		SELECT COUNT(*), COALESCE(MAX(volgorde), 0) 
		FROM relation_values 
		WHERE source_id = ? AND deleted_at IS NULL
	`
	err := a.db.QueryRow(checkQuery, sourceObjectID).Scan(&count, &maxVal)
	if err != nil {
		return 0, err
	}

	if maxVal != count || (maxVal == 0 && count > 0) {
		reindexQuery := `
			WITH Ordered AS (
				SELECT id, ROW_NUMBER() OVER (
					ORDER BY volgorde ASC, id ASC
				) AS new_order
				FROM relation_values
				WHERE source_id = ? AND deleted_at IS NULL
			)
			UPDATE relation_values
			SET volgorde = Ordered.new_order
			FROM Ordered
			WHERE relation_values.id = Ordered.id
		`
		_, err := a.db.Exec(reindexQuery, sourceObjectID)
		if err != nil {
			return 0, fmt.Errorf("fout bij opschonen relatievolgorde: %w", err)
		}
		return count, nil
	}

	return maxVal, nil
}

func (a *App) ExecuteMediaImport(mode string, groupName string, targetObjectID string, items []MediaImportItem) error {
	if a.db == nil {
		return fmt.Errorf("database niet verbonden")
	}

	if len(items) == 0 {
		return fmt.Errorf("geen items geselecteerd voor import")
	}

	a.logToUI("INFO", fmt.Sprintf("Starten van geoptimaliseerde import voor %d bestanden (Modus: %s)...", len(items), mode))

	exePath, _ := os.Executable()
	baseMediaDir := filepath.Join(filepath.Dir(exePath), "..", "Media")

	// 1. Batch duplicaatcontrole vooraf inladen
	existingPaths := make(map[string]bool)
	rows, err := a.db.Query(`
		SELECT value 
		FROM parameter_values 
		WHERE parameter_id = ? AND deleted_at IS NULL`, ParamIDAfbeelding)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pathVal string
			if err := rows.Scan(&pathVal); err == nil {
				existingPaths[pathVal] = true
			}
		}
	}

	// 2. Start ééne overkoepelende Database Transactie
	tx, err := a.db.Begin()
	if err != nil {
		return fmt.Errorf("fout bij starten transactie: %w", err)
	}
	defer tx.Rollback() // Zorgt voor rollback bij eventuele panic/fout

	// 3. Prepared Statements aanmaken binnen de transactie
	stmtInsertObject, err := tx.Prepare(`INSERT INTO objects (id, label, valid_from, updated_at) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmtInsertObject.Close()

	stmtInsertRel, err := tx.Prepare(`INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, valid_from, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmtInsertRel.Close()

	stmtInsertParam, err := tx.Prepare(`INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, valid_from, updated_at) VALUES (?, ?, ?, 'object', ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmtInsertParam.Close()

	// Relatievolgorde bepalen indien gekoppeld aan object
	currentMaxOrder := 0
	if mode == "OBJECT" && targetObjectID != "" {
		currentMaxOrder, _ = a.ReindexOutgoingRelations(targetObjectID)
	}

	// Bepaal of maak Groep-ID indien modus GROUP is
	var groupID string
	if mode == "GROUP" && groupName != "" {
		nowISO := time.Now().UTC().Format(time.RFC3339)
		err := tx.QueryRow(`SELECT id FROM objects WHERE label = ? AND deleted_at IS NULL`, groupName).Scan(&groupID)
		if err == sql.ErrNoRows {
			groupID = uuid.New().String()
			_, err = stmtInsertObject.Exec(groupID, groupName, nowISO, nowISO)
			if err != nil {
				return fmt.Errorf("fout bij aanmaken groep: %w", err)
			}
		}
		currentMaxOrder, _ = a.ReindexOutgoingRelations(groupID)
	}

	importedCount := 0
	nowISO := time.Now().UTC().Format(time.RFC3339)

	for _, item := range items {
		cleanRelPath := filepath.ToSlash(item.DestinationPath)

		// Snelle in-memory duplicaatcheck
		if existingPaths[cleanRelPath] {
			a.logToUI("WARN", fmt.Sprintf("Bestand '%s' bestaat al in de database. Import overgeslagen.", cleanRelPath))
			continue
		}

		// Fysiek verplaatsen op de schijf
		destFullPath := filepath.Join(baseMediaDir, filepath.FromSlash(cleanRelPath))
		if err := os.MkdirAll(filepath.Dir(destFullPath), 0755); err != nil {
			a.logToUI("ERROR", fmt.Sprintf("Maken van doelmap mislukt voor %s: %v", item.FileName, err))
			continue
		}

		if err := moveFile(item.OriginalPath, destFullPath); err != nil {
			a.logToUI("ERROR", fmt.Sprintf("Verplaatsen mislukt voor %s: %v", item.FileName, err))
			continue
		}

		// Insert Media Object & Parameters via Prepared Statements
		mediaID := uuid.New().String()
		label := fmt.Sprintf("%s: %s", item.MediaType, cleanRelPath)

		// 1. Insert Object
		if _, err := stmtInsertObject.Exec(mediaID, label, nowISO, nowISO); err != nil {
			a.logToUI("ERROR", fmt.Sprintf("Aanmaken DB-record mislukt voor %s: %v", item.FileName, err))
			continue
		}

		// 2. Type koppeling (Foto / Video)
		typeObjectID := ObjectTypeFotoID
		if item.MediaType == "VIDEO" {
			typeObjectID = ObjectTypeVideoID
		}
		if _, err := stmtInsertRel.Exec(uuid.New().String(), RelIDMediaKoppeling, typeObjectID, mediaID, nil, nowISO, nowISO); err != nil {
			a.logToUI("ERROR", fmt.Sprintf("Type koppelen mislukt: %v", err))
			continue
		}

		// 3. Parameter 'afbeelding'
		if _, err := stmtInsertParam.Exec(uuid.New().String(), ParamIDAfbeelding, mediaID, cleanRelPath, nowISO, nowISO); err != nil {
			a.logToUI("ERROR", fmt.Sprintf("Parameter pad invoegen mislukt: %v", err))
			continue
		}

		// 4. Parameter 'metadata'
		metaJSON, _ := json.Marshal(item.Metadata)
		if _, err := stmtInsertParam.Exec(uuid.New().String(), ParamIDMetadata, mediaID, string(metaJSON), nowISO, nowISO); err != nil {
			a.logToUI("ERROR", fmt.Sprintf("Parameter metadata invoegen mislukt: %v", err))
			continue
		}

		// 5. Koppeling aan Groep OF Object
		if mode == "GROUP" && groupID != "" {
			currentMaxOrder++
			if _, err := stmtInsertRel.Exec(uuid.New().String(), RelIDVerzamelingKoppeling, groupID, mediaID, currentMaxOrder, nowISO, nowISO); err != nil {
				a.logToUI("WARN", fmt.Sprintf("Koppelen aan groep mislukt: %v", err))
			}
		} else if mode == "OBJECT" && targetObjectID != "" {
			currentMaxOrder++
			if _, err := stmtInsertRel.Exec(uuid.New().String(), RelIDMediaKoppeling, targetObjectID, mediaID, currentMaxOrder, nowISO, nowISO); err != nil {
				a.logToUI("ERROR", fmt.Sprintf("Koppelen aan object mislukt voor %s: %v", item.FileName, err))
				continue
			}
		}

		existingPaths[cleanRelPath] = true
		importedCount++
	}

	// 4. Sluit de transactie in één keer af op de schijf
	if err := tx.Commit(); err != nil {
		a.logToUI("ERROR", fmt.Sprintf("Transactie commit mislukt: %v", err))
		return fmt.Errorf("fout bij opslaan in database: %w", err)
	}

	a.logToUI("SUCCESS", fmt.Sprintf("Import afgerond! %d van de %d bestanden bliksemsnel verwerkt.", importedCount, len(items)))
	return nil
}

func (a *App) insertMediaRecord(item MediaImportItem, relPath string, nowISO string) (string, error) {
	newUUID := uuid.New().String()

	// Label vastleggen conform afspraak (bijv: "FOTO: 2005/W17/20050425_104800_...")
	label := fmt.Sprintf("%s: %s", item.MediaType, relPath)

	// 1. Insert in 'objects'
	queryObj := `
		INSERT INTO objects (id, label, valid_from, updated_at)
		VALUES (?, ?, ?, ?)
	`
	_, err := a.db.Exec(queryObj, newUUID, label, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij invoegen media-object: %w", err)
	}

	// 2. Koppeling naar ObjectType Foto of Video
	typeObjectID := ObjectTypeFotoID
	if item.MediaType == "VIDEO" {
		typeObjectID = ObjectTypeVideoID
	}

	typeRelUUID := uuid.New().String()
	queryTypeRel := `
		INSERT INTO relation_values (id, relation_id, source_id, target_id, valid_from, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err = a.db.Exec(queryTypeRel, typeRelUUID, RelIDMediaKoppeling, typeObjectID, newUUID, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij koppelen van media-type relatie: %w", err)
	}

	// 3. Parameter 'afbeelding'
	paramValPadUUID := uuid.New().String()
	queryParamPath := `
		INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, valid_from, updated_at)
		VALUES (?, ?, ?, 'object', ?, ?, ?)
	`
	_, err = a.db.Exec(queryParamPath, paramValPadUUID, ParamIDAfbeelding, newUUID, relPath, nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij invoegen parameter 'afbeelding': %w", err)
	}

	// 4. Parameter 'metadata' (JSON)
	metaJSON, _ := json.Marshal(item.Metadata)
	paramValMetaUUID := uuid.New().String()
	queryParamMeta := `
		INSERT INTO parameter_values (id, parameter_id, target_id, target_type, value, valid_from, updated_at)
		VALUES (?, ?, ?, 'object', ?, ?, ?)
	`
	_, err = a.db.Exec(queryParamMeta, paramValMetaUUID, ParamIDMetadata, newUUID, string(metaJSON), nowISO, nowISO)
	if err != nil {
		return "", fmt.Errorf("fout bij invoegen parameter 'metadata': %w", err)
	}

	return newUUID, nil
}

func (a *App) addMediaToGroup(mediaID string, groupName string, nowISO string) error {
	var groupID string

	err := a.db.QueryRow(`SELECT id FROM objects WHERE label = ? AND deleted_at IS NULL`, groupName).Scan(&groupID)

	if err == sql.ErrNoRows {
		groupID = uuid.New().String()
		_, err = a.db.Exec(`
			INSERT INTO objects (id, label, valid_from, updated_at)
			VALUES (?, ?, ?, ?)
		`, groupID, groupName, nowISO, nowISO)
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	}

	maxOrder, _ := a.ReindexOutgoingRelations(groupID)

	relUUID := uuid.New().String()
	_, err = a.db.Exec(`
		INSERT INTO relation_values (id, relation_id, source_id, target_id, volgorde, valid_from, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, relUUID, RelIDVerzamelingKoppeling, groupID, mediaID, maxOrder+1, nowISO, nowISO)

	return err
}

func (a *App) GetObjectsForSelect(filter string) ([]ObjectSelectItem, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database niet verbonden")
	}

	query := `
		SELECT id, label 
		FROM objects 
		WHERE deleted_at IS NULL `

	var args []interface{}
	if filter != "" {
		query += " AND LOWER(label) LIKE LOWER(?) "
		args = append(args, "%"+filter+"%")
	}
	query += " ORDER BY label ASC LIMIT 100"

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ObjectSelectItem
	for rows.Next() {
		var item ObjectSelectItem
		if err := rows.Scan(&item.ID, &item.Label); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, nil
}

// Helpers
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

	if isVideoExt(ext) || ext == ".mov" {
		return a.extractVideoMetadata(path, meta)
	}

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

	return a.fallbackMetadata(path, meta)
}

func (a *App) fallbackMetadata(path string, meta MediaMetadataJSON) (MediaMetadataJSON, time.Time, bool) {
	if fileDate, ok := extractDateFromFileName(filepath.Base(path)); ok {
		meta.Opnamedatum = fileDate.Format("2006-01-02T15:04:05.0000000Z")
		return meta, fileDate, true
	}

	fi, err := os.Stat(path)
	if err == nil {
		modTime := fi.ModTime()
		meta.Opnamedatum = modTime.Format("2006-01-02T15:04:05.0000000Z")
		return meta, modTime, false
	}

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

	return nil
}

func getToolPath(toolName string) string {
	exePath, err := os.Executable()
	if err != nil {
		return filepath.Join("portable_magick", toolName)
	}
	return filepath.Join(filepath.Dir(exePath), "portable_magick", toolName)
}

func (a *App) extractVideoMetadata(path string, meta MediaMetadataJSON) (MediaMetadataJSON, time.Time, bool) {
	ffprobePath := getToolPath("ffprobe.exe")
	if _, err := os.Stat(ffprobePath); os.IsNotExist(err) {
		return a.fallbackMetadata(path, meta)
	}

	cmd := exec.Command(ffprobePath, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path)
	output, err := cmd.Output()
	if err != nil {
		return a.fallbackMetadata(path, meta)
	}

	var rawData struct {
		Format struct {
			Tags map[string]interface{} `json:"tags"`
		} `json:"format"`
	}

	if err := json.Unmarshal(output, &rawData); err == nil && rawData.Format.Tags != nil {
		for k, val := range rawData.Format.Tags {
			if strVal, ok := val.(string); ok {
				lk := strings.ToLower(k)
				if strings.Contains(lk, "creation_time") || strings.Contains(lk, "date") {
					if t, err := time.Parse(time.RFC3339, strVal); err == nil {
						meta.Opnamedatum = t.Format("2006-01-02T15:04:05.0000000Z")
						return meta, t, true
					}
				}
			}
		}
	}

	return a.fallbackMetadata(path, meta)
}