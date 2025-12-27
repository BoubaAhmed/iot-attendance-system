#include <LiquidCrystal.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>

// ---------- LCD ----------
LiquidCrystal lcd(21, 22, 18, 19, 23, 5);

// ---------- BUZZER ----------
#define BUZZER_PIN 27

// ---------- FINGERPRINT ----------
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger(&mySerial);

int enrollID = 1; // ID de départ

// ---------- BEEP ----------
void beep(int t)
{
    digitalWrite(BUZZER_PIN, HIGH);
    delay(t);
    digitalWrite(BUZZER_PIN, LOW);
}

// ---------- SETUP ----------
void setup()
{
    Serial.begin(115200);
    delay(2000);

    pinMode(BUZZER_PIN, OUTPUT);

    lcd.begin(16, 2);
    lcd.print("Initialisation");

    mySerial.begin(57600, SERIAL_8N1, 16, 17);
    finger.begin(57600);

    if (!finger.verifyPassword())
    {
        lcd.clear();
        lcd.print("Capteur ERR");
        Serial.println("AS608 NON detecte");
        while (1)
            ;
    }

    Serial.println("AS608 detecte");
    lcd.clear();
    lcd.print("AS608 OK");
    beep(200);
    delay(1500);

    // 🔥 Effacer toutes les empreintes
    finger.emptyDatabase();
    Serial.println("Base effacee");

    lcd.clear();
    lcd.print("Base effacee");
    delay(1500);

    lcd.clear();
    lcd.print("Pose doigt");
    lcd.setCursor(0, 1);
    lcd.print("Enregistrement");
}

// ---------- ENROLL ----------
void enrollFingerprint()
{
    int p = -1;

    Serial.print("Enregistrement ID ");
    Serial.println(enrollID);

    lcd.clear();
    lcd.print("Doigt ID ");
    lcd.print(enrollID);

    while (p != FINGERPRINT_OK)
    {
        p = finger.getImage();
    }

    finger.image2Tz(1);
    lcd.setCursor(0, 1);
    lcd.print("Retire doigt");
    delay(2000);

    while (finger.getImage() != FINGERPRINT_NOFINGER)
        ;

    lcd.clear();
    lcd.print("Encore doigt");

    while (finger.getImage() != FINGERPRINT_OK)
        ;

    finger.image2Tz(2);

    if (finger.createModel() != FINGERPRINT_OK)
    {
        Serial.println("Erreur modele");
        return;
    }

    finger.storeModel(enrollID);
    Serial.println("Empreinte enregistree");
    beep(300);

    enrollID++;
    delay(2000);
}

// ---------- SCAN ----------
void checkFingerprint()
{
    if (finger.getImage() != FINGERPRINT_OK)
        return;
    finger.image2Tz();
    finger.fingerFastSearch();

    lcd.clear();

    if (finger.fingerID != -1)
    {
        lcd.print("ACCES OK");
        lcd.setCursor(0, 1);
        lcd.print("ID: ");
        lcd.print(finger.fingerID);
        Serial.print("ID trouve: ");
        Serial.println(finger.fingerID);
        beep(300);
    }
    else
    {
        lcd.print("ACCES REFUSE");
        Serial.println("Empreinte inconnue");
        beep(100);
        delay(100);
        beep(100);
    }

    delay(2000);
    lcd.clear();
    lcd.print("Pose doigt");
}

// ---------- LOOP ----------
void loop()
{

    // 🔹 1er doigt = enregistrement
    if (enrollID <= 3)
    {
        enrollFingerprint();
    }
    // 🔹 ensuite reconnaissance
    else
    {
        checkFingerprint();
    }

    delay(200);
}
