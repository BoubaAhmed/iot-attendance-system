#include <LiquidCrystal.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <FirebaseESP32.h>

// ---------- LCD ----------
LiquidCrystal lcd(21, 22, 18, 19, 23, 5);

// ---------- BUZZER ----------
#define BUZZER_PIN 27

// ---------- FINGERPRINT ----------
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger(&mySerial);

// ---------- FIREBASE ----------
#define WIFI_SSID "inwi Home 4G9399CB"
#define WIFI_PASSWORD "38879322"
#define FIREBASE_HOST "iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "AIzaSyCiQkuIHnCFbAxfhxMpdVfk0PymoYkY66g"

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- VARIABLES ----------
String studentNames[50];
int fingerprintIds[50];
int studentCount = 0;

// ---------- BEEP ----------
void beep(int t)
{
    digitalWrite(BUZZER_PIN, HIGH);
    delay(t);
    digitalWrite(BUZZER_PIN, LOW);
}

// ---------- AFFICHER LCD ----------
void showLCD(String line1, String line2 = "", int delayMs = 0)
{
    lcd.clear();
    lcd.print(line1);
    if (line2.length() > 0)
    {
        lcd.setCursor(0, 1);
        lcd.print(line2);
    }
    if (delayMs > 0)
        delay(delayMs);
}

// ---------- SETUP ----------
void setup()
{
    Serial.begin(115200);
    delay(1000);

    pinMode(BUZZER_PIN, OUTPUT);

    // LCD
    lcd.begin(16, 2);
    showLCD("Test de", "reconnaissance", 2000);

    // Capteur empreinte
    mySerial.begin(57600, SERIAL_8N1, 16, 17);
    finger.begin(57600);
    delay(1000);

    if (!finger.verifyPassword())
    {
        showLCD("ERREUR", "Capteur AS608", 0);
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    Serial.println("AS608 détecté");
    showLCD("AS608 OK", "", 1500);
    beep(200);

    // Afficher la liste des empreintes enregistrées
    showLCD("Verification", "empreintes...", 1000);

    Serial.println("\n=== LISTE DES EMPREINTES DANS LE CAPTEUR ===");

    if (finger.getTemplateCount() == FINGERPRINT_OK)
    {
        Serial.print("Nombre total d'empreintes : ");
        Serial.println(finger.templateCount);

        for (int id = 1; id <= finger.templateCount; id++)
        {
            if (finger.loadModel(id) == FINGERPRINT_OK)
            {
                Serial.print("✔ Empreinte ID ");
                Serial.println(id);
            }
        }
    }
    else
    {
        Serial.println("Erreur lecture templates");
    }

    // Connexion WiFi (optionnelle pour récupérer les noms)
    showLCD("Connexion WiFi", "", 0);
    Serial.print("Connexion WiFi ");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        Serial.print(".");
        delay(500);
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("\nWiFi connecté!");

        // Connexion Firebase
        fbConfig.host = FIREBASE_HOST;
        fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;

        Firebase.begin(&fbConfig, &fbAuth);
        Firebase.reconnectWiFi(true);
        delay(2000);

        if (Firebase.ready())
        {
            Serial.println("Firebase connecté!");

            // Récupérer les étudiants pour afficher les noms
            studentCount = 0;
            for (int i = 1; i <= 10; i++)
            {
                String namePath = "/students/" + String(i) + "/name";
                if (Firebase.getString(fbData, namePath))
                {
                    studentNames[studentCount] = fbData.stringData();

                    String fingerPath = "/students/" + String(i) + "/fingerprint_id";
                    if (Firebase.getInt(fbData, fingerPath))
                    {
                        fingerprintIds[studentCount] = fbData.intData();
                    }

                    Serial.print("Etudiant ");
                    Serial.print(i);
                    Serial.print(": ");
                    Serial.print(studentNames[studentCount]);
                    Serial.print(" (ID empreinte: ");
                    Serial.print(fingerprintIds[studentCount]);
                    Serial.println(")");

                    studentCount++;
                }
            }

            if (studentCount > 0)
            {
                showLCD("Etudiants trouves", String(studentCount), 2000);
            }
        }
        else
        {
            Serial.println("Mode local (sans noms)");
            showLCD("Mode local", "Reconnaissance", 2000);
        }
    }
    else
    {
        Serial.println("\nMode local (sans WiFi)");
        showLCD("Mode local", "Reconnaissance", 2000);
    }

    showLCD("Pret a scanner", "Posez le doigt", 2000);
}

// ---------- TROUVER NOM PAR ID EMPREINTE ----------
String findStudentName(int fingerprintId)
{
    for (int i = 0; i < studentCount; i++)
    {
        if (fingerprintIds[i] == fingerprintId)
        {
            return studentNames[i];
        }
    }
    return "Inconnu";
}

// ---------- LOOP ----------
void loop()
{
    // Vérifier si un doigt est présent
    int result = finger.getImage();

    if (result == FINGERPRINT_OK)
    {
        // Doigt détecté, convertir
        result = finger.image2Tz();
        if (result != FINGERPRINT_OK)
        {
            Serial.println("Erreur conversion image");
            return;
        }

        // Rechercher l'empreinte
        result = finger.fingerFastSearch();

        if (result == FINGERPRINT_OK)
        {
            // Empreinte trouvée !
            int foundId = finger.fingerID;
            int confidence = finger.confidence;

            Serial.print("\n=== EMPREINTE RECONNUE ===");
            Serial.print("\nID: ");
            Serial.print(foundId);
            Serial.print("\nConfiance: ");
            Serial.println(confidence);

            // Trouver le nom de l'étudiant
            String studentName = findStudentName(foundId);

            // Afficher sur LCD
            if (studentName != "Inconnu")
            {
                showLCD("Bonjour", studentName, 2000);
                Serial.print("Etudiant: ");
                Serial.println(studentName);
            }
            else
            {
                showLCD("Empreinte ID", String(foundId), 2000);
                Serial.print("Empreinte ID ");
                Serial.print(foundId);
                Serial.println(" (non assignee)");
            }

            beep(300);
            delay(1000);
            showLCD("Posez le doigt", "pour scanner", 0);
        }
        else if (result == FINGERPRINT_NOTFOUND)
        {
            // Empreinte non reconnue
            Serial.println("Empreinte non reconnue");
            showLCD("Non reconnu", "Essayez encore", 2000);
            beep(100);
            delay(100);
            beep(100);
            showLCD("Posez le doigt", "pour scanner", 0);
        }
    }

    delay(100);
}