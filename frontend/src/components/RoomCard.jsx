import React from 'react';
import {
  SignalIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const RoomCard = ({ room, onEdit, onToggleStatus, showActions = true }) => {
  // Vérifier si la salle est en ligne
  const isOnline = room.last_seen ? (
    (new Date() - new Date(room.last_seen)) / (1000 * 60) < 5
  ) : false;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{room.name}</h3>
          <p className="text-sm text-gray-600">{room.location || '—'}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs ${
          isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </span>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm">
          <SignalIcon className="h-4 w-4 text-gray-400 mr-2" />
          <span>ESP32: {room.esp32_id || 'Non configuré'}</span>
        </div>
        
        <div className="flex items-center text-sm">
          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
          <span>
            {room.last_seen 
              ? `Dernière connexion: ${new Date(room.last_seen).toLocaleTimeString()}`
              : 'Jamais connecté'
            }
          </span>
        </div>
      </div>
      
      {showActions && onEdit && onToggleStatus && (
        <div className="flex justify-between border-t pt-3">
          <button
            onClick={onEdit}
            className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm"
          >
            Configurer
          </button>
          
          <button
            onClick={onToggleStatus}
            className={`px-3 py-2 rounded-lg text-sm ${
              room.active
                ? 'text-red-600 hover:bg-red-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {room.active ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RoomCard;