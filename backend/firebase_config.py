# firebase_config.py
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
            ref = self.get_ref(path)
            data = ref.get()
            return data if data is not None else {}
        except Exception as e:
            print(f"⚠️ Erreur récupération {path}: {e}")
            return {}
    
    def get_one(self, path, key=None):
        """Récupérer un élément spécifique"""
        try:
            ref = self.get_ref(path)
            data = ref.get()
            
            if key:
                # If it's a list (like students), search by key
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and str(item.get('fingerprint_id')) == str(key):
                            return item
                    return None
                # If it's a dict, return the value
                return data.get(key) if data else None
            
            return data
        except Exception as e:
            print(f"⚠️ Erreur récupération {path}/{key}: {e}")
            return None
    
    def create(self, path, data, key=None):
        """Créer une nouvelle entrée"""
        try:
            ref = self.get_ref(path)
            
            if key:
                ref.child(key).set(data)
                return key
            else:
                # If path exists and is a list, append to it
                existing_data = ref.get()
                if isinstance(existing_data, list):
                    existing_data.append(data)
                    ref.set(existing_data)
                    return len(existing_data) - 1
                else:
                    # Create as new array
                    ref.set([data])
                    return 0
        except Exception as e:
            print(f"⚠️ Erreur création {path}: {e}")
            raise
    
    def update(self, path, key, data):
        """Mettre à jour une entrée existante"""
        try:
            ref = self.get_ref(path)
            existing_data = ref.get()
            
            if isinstance(existing_data, list):
                # Find and update item in list
                for i, item in enumerate(existing_data):
                    if isinstance(item, dict) and str(item.get('fingerprint_id')) == str(key):
                        existing_data[i].update(data)
                        ref.set(existing_data)
                        return True
                return False
            else:
                # If data is a list, set the child directly (firebase update requires a dict)
                if isinstance(data, list):
                    ref.child(key).set(data)
                    return True

                # Update in dictionary
                ref.child(key).update(data)
                return True
        except Exception as e:
            print(f"⚠️ Erreur mise à jour {path}/{key}: {e}")
            raise
    
    def delete(self, path, key):
        """Supprimer une entrée"""
        try:
            ref = self.get_ref(path)
            existing_data = ref.get()
            
            if isinstance(existing_data, list):
                # Remove item from list
                new_data = []
                for item in existing_data:
                    if isinstance(item, dict) and str(item.get('fingerprint_id')) != str(key):
                        new_data.append(item)
                ref.set(new_data)
            else:
                ref.child(key).delete()
        except Exception as e:
            print(f"⚠️ Erreur suppression {path}/{key}: {e}")
            raise
    
    def update_at_path(self, path, data):
        """Update at specific path"""
        try:
            ref = self.get_ref(path)
            ref.update(data)
        except Exception as e:
            print(f"⚠️ Erreur mise à jour {path}: {e}")
            raise
    
    def delete_at_path(self, path):
        """Delete at specific path"""
        try:
            ref = self.get_ref(path)
            ref.delete()
        except Exception as e:
            print(f"⚠️ Erreur suppression {path}: {e}")
            raise
    
    def get_at_path(self, path):
        """Get data at specific path"""
        ref = self.get_ref(path)
        return ref.get()

# Instance globale
firebase = FirebaseConfig()