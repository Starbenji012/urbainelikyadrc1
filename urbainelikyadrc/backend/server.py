#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Server.py - Backend Flask pour Urbain ElikyaDRC
Gère les API pour les signalements, idées, utilisateurs et contacts
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import os
from functools import wraps

app = Flask(__name__)
CORS(app)

# Chemins des fichiers de données
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SIGNALEMENTS_FILE = os.path.join(DATA_DIR, 'signalements.json')
IDEES_FILE = os.path.join(DATA_DIR, 'idees.json')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
CONTACTS_FILE = os.path.join(DATA_DIR, 'contacts.json')
TEMOIGNAGES_FILE = os.path.join(DATA_DIR, 'temoignage.json')

# Créer le répertoire data s'il n'existe pas
os.makedirs(DATA_DIR, exist_ok=True)

# ===========================
# Fonctions Utilitaires
# ===========================

def load_json(file_path):
    """Charge les données depuis un fichier JSON"""
    if not os.path.exists(file_path):
        return []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []

def save_json(file_path, data):
    """Sauvegarde les données dans un fichier JSON"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def validate_email(email):
    """Valide le format d'une adresse email"""
    import re
    return re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email) is not None

def require_json(f):
    """Décorateur pour vérifier que les données reçues sont du JSON"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        return f(*args, **kwargs)
    return decorated_function

# ===========================
# Routes Signalements
# ===========================

@app.route('/api/signalements', methods=['GET'])
def get_signalements():
    """Récupère tous les signalements"""
    signalements = load_json(SIGNALEMENTS_FILE)
    return jsonify(signalements), 200

@app.route('/api/signalements', methods=['POST'])
@require_json
def create_signalement():
    """Crée un nouveau signalement"""
    try:
        data = request.get_json()
        
        # Validation
        if not data.get('titre'):
            return jsonify({'error': 'Le titre est requis'}), 400
        if not data.get('description'):
            return jsonify({'error': 'La description est requise'}), 400
        if not data.get('lat') or not data.get('lng'):
            return jsonify({'error': 'Les coordonnées sont requises'}), 400
        
        # Créer le signalement
        signalement = {
            'id': datetime.now().timestamp(),
            'titre': data['titre'],
            'description': data['description'],
            'type': data.get('type', 'autre'),
            'lat': float(data['lat']),
            'lng': float(data['lng']),
            'lieu': data.get('lieu', ''),
            'photo': data.get('photo', ''),
            'etat': 'en_cours',
            'timestamp': datetime.now().isoformat(),
            'utilisateur': data.get('utilisateur', 'Anonyme')
        }
        
        # Sauvegarder
        signalements = load_json(SIGNALEMENTS_FILE)
        signalements.append(signalement)
        save_json(SIGNALEMENTS_FILE, signalements)
        
        return jsonify(signalement), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/signalements/<sig_id>', methods=['GET'])
def get_signalement(sig_id):
    """Récupère un signalement spécifique"""
    signalements = load_json(SIGNALEMENTS_FILE)
    for sig in signalements:
        if str(sig.get('id')) == sig_id:
            return jsonify(sig), 200
    return jsonify({'error': 'Signalement non trouvé'}), 404

@app.route('/api/signalements/<sig_id>', methods=['PUT'])
@require_json
def update_signalement(sig_id):
    """Met à jour un signalement"""
    try:
        data = request.get_json()
        signalements = load_json(SIGNALEMENTS_FILE)
        
        for i, sig in enumerate(signalements):
            if str(sig.get('id')) == sig_id:
                sig.update({
                    'titre': data.get('titre', sig['titre']),
                    'description': data.get('description', sig['description']),
                    'etat': data.get('etat', sig['etat']),
                    'type': data.get('type', sig['type'])
                })
                save_json(SIGNALEMENTS_FILE, signalements)
                return jsonify(sig), 200
        
        return jsonify({'error': 'Signalement non trouvé'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/signalements/<sig_id>', methods=['DELETE'])
def delete_signalement(sig_id):
    """Supprime un signalement"""
    signalements = load_json(SIGNALEMENTS_FILE)
    for i, sig in enumerate(signalements):
        if str(sig.get('id')) == sig_id:
            signalements.pop(i)
            save_json(SIGNALEMENTS_FILE, signalements)
            return jsonify({'message': 'Signalement supprimé'}), 200
    return jsonify({'error': 'Signalement non trouvé'}), 404

# ===========================
# Routes Idées
# ===========================

@app.route('/api/idees', methods=['GET'])
def get_idees():
    """Récupère toutes les idées"""
    idees = load_json(IDEES_FILE)
    return jsonify(idees), 200

@app.route('/api/idees', methods=['POST'])
@require_json
def create_idee():
    """Crée une nouvelle idée"""
    try:
        data = request.get_json()
        
        if not data.get('titre'):
            return jsonify({'error': 'Le titre est requis'}), 400
        if not data.get('description'):
            return jsonify({'error': 'La description est requise'}), 400
        
        idee = {
            'id': datetime.now().timestamp(),
            'titre': data['titre'],
            'description': data['description'],
            'categorie': data.get('categorie', 'général'),
            'photo': data.get('photo', ''),
            'votes': 0,
            'timestamp': datetime.now().isoformat(),
            'utilisateur': data.get('utilisateur', 'Anonyme')
        }
        
        idees = load_json(IDEES_FILE)
        idees.append(idee)
        save_json(IDEES_FILE, idees)
        
        return jsonify(idee), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/idees/<idee_id>', methods=['DELETE'])
def delete_idee(idee_id):
    """Supprime une idée"""
    idees = load_json(IDEES_FILE)
    for i, idee in enumerate(idees):
        if str(idee.get('id')) == idee_id:
            idees.pop(i)
            save_json(IDEES_FILE, idees)
            return jsonify({'message': 'Idée supprimée'}), 200
    return jsonify({'error': 'Idée non trouvée'}), 404

# ===========================
# Routes Utilisateurs
# ===========================

@app.route('/api/users/register', methods=['POST'])
@require_json
def register_user():
    """Enregistre un nouvel utilisateur"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email et mot de passe requis'}), 400
        
        if not validate_email(data['email']):
            return jsonify({'error': 'Format email invalide'}), 400
        
        users = load_json(USERS_FILE)
        
        # Vérifier si l'email existe déjà
        for user in users:
            if user.get('email') == data['email']:
                return jsonify({'error': 'Email déjà enregistré'}), 400
        
        # Créer l'utilisateur
        user = {
            'id': datetime.now().timestamp(),
            'nom': data.get('nom', ''),
            'prenom': data.get('prenom', ''),
            'surnom': data.get('surnom', ''),
            'email': data['email'],
            'password': data['password'],  # À hacher en production!
            'timestamp': datetime.now().isoformat()
        }
        
        users.append(user)
        save_json(USERS_FILE, users)
        
        return jsonify({'message': 'Utilisateur enregistré', 'id': user['id']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/login', methods=['POST'])
@require_json
def login_user():
    """Connecte un utilisateur"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email et mot de passe requis'}), 400
        
        users = load_json(USERS_FILE)
        
        for user in users:
            if user.get('email') == data['email'] and user.get('password') == data['password']:
                return jsonify({
                    'message': 'Connexion réussie',
                    'user_id': user['id'],
                    'nom': user.get('nom'),
                    'prenom': user.get('prenom'),
                    'email': user.get('email')
                }), 200
        
        return jsonify({'error': 'Email ou mot de passe incorrect'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===========================
# Routes Contacts
# ===========================

@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    """Récupère tous les messages de contact"""
    contacts = load_json(CONTACTS_FILE)
    return jsonify(contacts), 200

@app.route('/api/contacts', methods=['POST'])
@require_json
def create_contact():
    """Crée un nouveau message de contact"""
    try:
        data = request.get_json()
        
        if not data.get('nom') or not data.get('email'):
            return jsonify({'error': 'Nom et email requis'}), 400
        
        if not data.get('message'):
            return jsonify({'error': 'Le message est requis'}), 400
        
        contact = {
            'id': datetime.now().timestamp(),
            'nom': data['nom'],
            'email': data['email'],
            'sujet': data.get('sujet', ''),
            'message': data['message'],
            'timestamp': datetime.now().isoformat(),
            'statut': 'non_lu'
        }
        
        contacts = load_json(CONTACTS_FILE)
        contacts.append(contact)
        save_json(CONTACTS_FILE, contacts)
        
        return jsonify(contact), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===========================
# Routes Statistiques
# ===========================

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Récupère les statistiques globales"""
    signalements = load_json(SIGNALEMENTS_FILE)
    idees = load_json(IDEES_FILE)
    users = load_json(USERS_FILE)
    
    stats = {
        'total_signalements': len(signalements),
        'signalements_en_cours': len([s for s in signalements if s.get('etat') == 'en_cours']),
        'signalements_resolus': len([s for s in signalements if s.get('etat') == 'resolus']),
        'total_idees': len(idees),
        'total_utilisateurs': len(users)
    }
    
    return jsonify(stats), 200

# ===========================
# Routes Health Check
# ===========================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Vérifie que le serveur fonctionne"""
    return jsonify({'status': 'OK', 'message': 'Urbain ElikyaDRC API is running'}), 200

@app.route('/', methods=['GET'])
def index():
    """Page d'accueil de l'API"""
    return jsonify({
        'name': 'Urbain ElikyaDRC API',
        'version': '1.0.0',
        'description': 'API pour la plateforme de signalement urbain',
        'endpoints': {
            'signalements': '/api/signalements',
            'idees': '/api/idees',
            'users_register': '/api/users/register',
            'users_login': '/api/users/login',
            'contacts': '/api/contacts',
            'stats': '/api/stats',
            'health': '/api/health'
        }
    }), 200

# ===========================
# Gestion des erreurs
# ===========================

@app.errorhandler(404)
def not_found(error):
    """Gère les routes não trouvées"""
    return jsonify({'error': 'Endpoint non trouvé'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Gère les erreurs serveur"""
    return jsonify({'error': 'Erreur serveur interne'}), 500

# ===========================
# Point d'entrée
# ===========================

if __name__ == '__main__':
    print('🚀 Démarrage du serveur Urbain ElikyaDRC API...')
    print('📍 URL locale: http://localhost:5000')
    print('📚 Documentation API disponible à http://localhost:5000/')
    app.run(debug=True, host='0.0.0.0', port=5000)
