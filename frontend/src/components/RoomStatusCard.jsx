import React from 'react';
import { FiWifi, FiMapPin, FiCpu, FiActivity } from 'react-icons/fi';

const RoomStatusCard = ({ room }) => {
  const isOnline = room.last_seen && 
    (new Date() - new Date(room.last_seen)) / (1000 * 60) < 5;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h3 className="font-semibold text-gray-900">{room.name}</h3>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
              isOnline 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isOnline ? '● En ligne' : '○ Hors ligne'}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600 mb-1">
            <FiMapPin className="mr-1 h-4 w-4" />
            {room.location || 'Localisation non définie'}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <FiCpu className="mr-1 h-4 w-4" />
            <span className="font-mono text-xs">{room.esp32_id || 'ID ESP32'}</span>
          </div>
        </div>
        <div className={`p-2 rounded-lg ${
          isOnline ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
        }`}>
          <FiWifi className="h-5 w-5" />
        </div>
      </div>
      
      {room.last_seen && (
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center text-xs text-gray-500">
            <FiActivity className="mr-1 h-3 w-3" />
            Dernière activité: {new Date(room.last_seen).toLocaleTimeString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomStatusCard;