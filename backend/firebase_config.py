import firebase_admin
from firebase_admin import credentials, db
import json
import os

class FirebaseConfig:
    """Configuration simple de Firebase"""
    
    def __init__(self):
        # Initialiser Firebase une seule fois
        if not firebase_admin._apps:
            try:
                # Chercher le fichier de service
                service_key_path = "serviceAccountKey.json"
                
                if os.path.exists(service_key_path):
                    cred = credentials.Certificate(service_key_path)
                    firebase_admin.initialize_app(cred, {
                        'databaseURL': 'https://iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app'
                    })
                    print("✅ Firebase initialisé avec le fichier de service")
                else:
                    print("⚠️  ATTENTION: serviceAccountKey.json non trouvé")
                    print("🔗 Utilisation de la base de données en lecture seule")
                    
                    # Initialiser sans credentials (lecture seule)
                    firebase_admin.initialize_app(options={
                        'databaseURL': 'https://iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app'
                    })
            except Exception as e:
                print(f"❌ Erreur initialisation Firebase: {e}")
                raise
        
        self.db = db
        self.root_ref = db.reference('/')
    
    def get_ref(self, path=""):
        """Obtenir une référence à un chemin Firebase"""
        return self.db.reference(path)
    
    def get_all(self, path):
        """Récupérer toutes les données d'un chemin"""
        try:
            data = self.get_ref(path).get()
            return data or {}
        except Exception as e:
            print(f"⚠️ Erreur récupération {path}: {e}")
            return {}
    
    def get_one(self, path, key):
        """Récupérer un élément spécifique"""
        try:
            return self.get_ref(f"{path}/{key}").get()
        except Exception as e:
            print(f"⚠️ Erreur récupération {path}/{key}: {e}")
            return None
    
    def create(self, path, data, key=None):
        """Créer une nouvelle entrée"""
        try:
            if key:
                self.get_ref(f"{path}/{key}").set(data)
                return key
            else:
                new_ref = self.get_ref(path).push()
                new_ref.set(data)
                return new_ref.key
        except Exception as e:
            print(f"⚠️ Erreur création {path}: {e}")
            raise
    
    def update(self, path, key, data):
        """Mettre à jour une entrée"""
        try:
            self.get_ref(f"{path}/{key}").update(data)
        except Exception as e:
            print(f"⚠️ Erreur mise à jour {path}/{key}: {e}")
            raise
    
    def delete(self, path, key):
        """Supprimer une entrée"""
        try:
            self.get_ref(f"{path}/{key}").delete()
        except Exception as e:
            print(f"⚠️ Erreur suppression {path}/{key}: {e}")
            raise

# Instance globale
firebase = FirebaseConfig()