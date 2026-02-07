#include <LiquidCrystal.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <time.h>

// Configuration
#define BUZZER_PIN 27
#define ROOM_NAME "roomA"  // ← Changez ici (roomA, roomB, infoA, etc.)

// WiFi
#define WIFI_SSID "Redmi 9T"
#define WIFI_PASSWORD "123456789"
#define FIREBASE_HOST "iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "your-api-key"

// Hardware
LiquidCrystal lcd(21, 22, 18, 19, 23, 5);
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger(&mySerial);
FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// Variables globales
String currentSessionId = "";
String currentGroup = "";
bool sessionActive = false;
bool attendanceInitialized = false;
unsigned long lastCheck = 0;

struct Student {
    String id;
    String name;
    int fingerprintId;
    String group;
    bool active;
};
Student students[50];
int studentCount = 0;

// Fonctions simplifiées
void beep(int t) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(t);
    digitalWrite(BUZZER_PIN, LOW);
}

void lcdShow(String line1, String line2 = "") {
    lcd.clear();
    lcd.print(line1);
    if (line2.length() > 0) {
        lcd.setCursor(0, 1);
        lcd.print(line2);
    }
}

String getDate() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) return "2025-01-15";
    char dateStr[11];
    strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", &timeinfo);
    return String(dateStr);
}

String getTime() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) return "00:00";
    char timeStr[6];
    strftime(timeStr, sizeof(timeStr), "%H:%M", &timeinfo);
    return String(timeStr);
}

// Chargement des étudiants
void loadStudents() {
    lcdShow("Chargement", "etudiants...");
    
    if (!Firebase.getJSON(fbData, "/students")) {
        lcdShow("Erreur DB", "");
        return;
    }

    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;

    studentCount = 0;
    for (size_t i = 0; i < len; i++) {
        json.iteratorGet(i, type, key, value);
        if (type != FirebaseJson::JSON_OBJECT) continue;

        String studentId = key;
        String path = "/students/" + studentId;

        bool isActive = false;
        if (Firebase.getBool(fbData, path + "/active")) isActive = fbData.boolData();
        if (!isActive) continue;

        students[studentCount].id = studentId;
        Firebase.getString(fbData, path + "/name");
        students[studentCount].name = fbData.stringData();
        Firebase.getInt(fbData, path + "/fingerprint_id");
        students[studentCount].fingerprintId = fbData.intData();
        Firebase.getString(fbData, path + "/group");
        students[studentCount].group = fbData.stringData();
        students[studentCount].active = isActive;

        studentCount++;
        if (studentCount >= 50) break;
    }
    json.iteratorEnd();
    
    lcdShow("Etudiants:", String(studentCount));
    delay(1500);
}

// Vérifier session active
bool checkSession() {
    String today = getDate();
    String path = "/sessions/" + today + "/" + ROOM_NAME;
    
    if (!Firebase.getJSON(fbData, path)) {
        lcdShow("Pas de session", "aujourd'hui");
        sessionActive = false;
        return false;
    }

    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;

    for (size_t i = 0; i < len; i++) {
        json.iteratorGet(i, type, key, value);
        if (type != FirebaseJson::JSON_OBJECT) continue;
        
        String sessionPath = path + "/" + String(i);
        
        String status = "";
        if (Firebase.getString(fbData, sessionPath + "/status")) {
            status = fbData.stringData();
        }

        if (status == "ACTIVE" || status == "STARTED" || status == "RUNNING") {
            if (Firebase.getString(fbData, sessionPath + "/group")) {
                currentGroup = fbData.stringData();
            }
            if (Firebase.getString(fbData, sessionPath + "/session_id")) {
                currentSessionId = fbData.stringData();
            } else {
                String cleanDate = today;
                cleanDate.replace("-", "");

                String cleanTime = getTime();
                cleanTime.replace(":", "");

                currentSessionId = cleanDate + "_" + ROOM_NAME + "_" + cleanTime + "_" + currentGroup;

                // currentSessionId = today.replace("-", "") + "_" + ROOM_NAME + "_" + getTime().replace(":", "") + "_" + currentGroup;
            }
            
            String subject = "";
            if (Firebase.getString(fbData, sessionPath + "/subject")) subject = fbData.stringData();
            
            lcdShow("Session active", subject);
            sessionActive = true;
            attendanceInitialized = false;
            json.iteratorEnd();
            return true;
        }
    }
    
    json.iteratorEnd();
    lcdShow("Pas de session", "active");
    sessionActive = false;
    return false;
}

// Initialiser les absences
void initAbsences() {
    if (!sessionActive || currentSessionId == "" || currentGroup == "") return;
    
    String path = "/attendance/" + currentSessionId;
    if (Firebase.getJSON(fbData, path)) {
        attendanceInitialized = true;
        return;
    }
    
    lcdShow("Initialisation", "absences...");
    
    FirebaseJson attendanceJson;
    FirebaseJson presentJson;  // Vide au début
    FirebaseJson absentJson;
    
    int groupCount = 0;
    for (int i = 0; i < studentCount; i++) {
        if (students[i].group == currentGroup && students[i].active) {
            FirebaseJson studentJson;
            studentJson.set("name", students[i].name);
            absentJson.set(students[i].id, studentJson);
            groupCount++;
        }
    }
    
    attendanceJson.set("present", presentJson);
    attendanceJson.set("absent", absentJson);
    
    if (Firebase.setJSON(fbData, path, attendanceJson)) {
        attendanceInitialized = true;
        beep(200); delay(100); beep(200);
        lcdShow("Absences init:", String(groupCount) + " etu.");
        delay(1500);
    } else {
        lcdShow("Erreur init", "");
        delay(1000);
    }
}

// Trouver étudiant par empreinte
Student* findStudent(int fingerprintId) {
    for (int i = 0; i < studentCount; i++) {
        if (students[i].fingerprintId == fingerprintId && students[i].active) {
            return &students[i];
        }
    }
    return nullptr;
}

// Vérifier si dans le groupe
bool inGroup(String studentId) {
    if (currentGroup == "") return false;
    for (int i = 0; i < studentCount; i++) {
        if (students[i].id == studentId && students[i].group == currentGroup) return true;
    }
    return false;
}

// Enregistrer présence
void recordPresence(String studentId, String studentName) {
    if (!sessionActive || !attendanceInitialized) {
        lcdShow("Erreur", "Session inactive");
        return;
    }
    
    String absentPath = "/attendance/" + currentSessionId + "/absent/" + studentId;
    String presentPath = "/attendance/" + currentSessionId + "/present/" + studentId;
    
    if (Firebase.getJSON(fbData, presentPath)) {
        lcdShow("Deja present", "");
        beep(100); delay(100); beep(100);
        return;
    }
    
    if (!Firebase.getJSON(fbData, absentPath)) {
        lcdShow("Erreur", "Absent?");
        return;
    }
    
    Firebase.deleteNode(fbData, absentPath);
    
    FirebaseJson presentJson;
    presentJson.set("name", studentName);
    presentJson.set("time", getTime());
    
    if (Firebase.setJSON(fbData, presentPath, presentJson)) {
        lcdShow("Present:", studentName);
        beep(300); delay(200); beep(300);
    } else {
        lcdShow("Erreur", "enregistrement");
    }
}

// Setup
void setup() {
    Serial.begin(115200);
    pinMode(BUZZER_PIN, OUTPUT);
    
    lcd.begin(16, 2);
    lcdShow("Systeme", "Presence");
    delay(2000);
    
    // Capteur empreinte
    mySerial.begin(57600, SERIAL_8N1, 16, 17);
    finger.begin(57600);
    delay(1000);
    
    if (!finger.verifyPassword()) {
        lcdShow("Erreur", "Capteur");
        while(1) { beep(100); delay(1000); }
    }
    
    lcdShow("Capteur OK", "");
    beep(200);
    
    // WiFi
    lcdShow("WiFi...", "");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        attempts++;
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        lcdShow("Erreur WiFi", "");
        while(1) { beep(100); delay(1000); }
    }
    
    lcdShow("WiFi OK", "");
    delay(1000);
    
    // Heure
    configTime(0, 3600, "pool.ntp.org");
    delay(2000);
    
    // Firebase
    fbConfig.host = FIREBASE_HOST;
    fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
    Firebase.begin(&fbConfig, &fbAuth);
    Firebase.reconnectWiFi(true);
    delay(2000);
    
    if (!Firebase.ready()) {
        lcdShow("Erreur Firebase", "");
        while(1) { beep(100); delay(1000); }
    }
    
    lcdShow("DB OK", "");
    beep(200);
    
    // Charger étudiants et vérifier session
    loadStudents();
    checkSession();
    lcdShow("Pret a scanner", "");
}

// Loop
void loop() {
    // Vérifier session toutes les minutes
    if (millis() - lastCheck > 60000) {
        checkSession();
        lastCheck = millis();
    }
    
    if (!sessionActive) {
        delay(1000);
        return;
    }
    
    if (!attendanceInitialized) {
        initAbsences();
        delay(1000);
        return;
    }
    
    // Détection empreinte
    int result = finger.getImage();
    if (result == FINGERPRINT_OK) {
        result = finger.image2Tz();
        if (result != FINGERPRINT_OK) return;
        
        result = finger.fingerFastSearch();
        
        if (result == FINGERPRINT_OK) {
            int foundId = finger.fingerID;
            Student* student = findStudent(foundId);
            
            if (student != nullptr) {
                lcdShow("Bonjour", student->name);
                delay(1000);
                
                if (inGroup(student->id)) {
                    recordPresence(student->id, student->name);
                } else {
                    lcdShow("Mauvais groupe", "");
                    beep(100); delay(100); beep(100);
                }
                
                delay(1000);
                lcdShow("Pret a scanner", "");
            } else {
                lcdShow("Non reconnu", "");
                beep(100); delay(100); beep(100);
                lcdShow("Pret a scanner", "");
            }
        } else if (result == FINGERPRINT_NOTFOUND) {
            lcdShow("Inconnu", "");
            beep(100); delay(100); beep(100);
            lcdShow("Pret a scanner", "");
        }
    }
    
    delay(100);
}