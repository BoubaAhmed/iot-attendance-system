#include <LiquidCrystal.h>

// LCD pins: RS, E, D4, D5, D6, D7
LiquidCrystal lcd(21, 22, 18, 19, 23, 5);

// Buzzer pin
#define BUZZER_PIN 27

void beep(int duration)
{
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
}

void setup()
{
    // Buzzer setup
    pinMode(BUZZER_PIN, OUTPUT);

    // LCD setup
    lcd.begin(16, 2);
    lcd.clear();

    // Display message
    lcd.setCursor(0, 0);
    lcd.print("ESP32 Ready");
    lcd.setCursor(0, 1);
    lcd.print("LCD + Buzzer");

    // Startup beep
    beep(200);
    delay(200);
    beep(200);
}

void loop()
{
    // Nothing here for now
}
