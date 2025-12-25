import React from 'react';
import {
  FingerPrintIcon,
  CreditCardIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const AttendanceTable = ({ 
  attendance, 
  showActions = false,
  onAction,
  title = "Liste des présences"
}) => {
  if (!attendance || Object.keys(attendance).length === 0) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune présence enregistrée</p>
      </div>
    );
  }

  const attendanceArray = Object.entries(attendance).map(([studentId, data]) => ({
    studentId,
    ...data
  }));

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-500">
          {attendanceArray.length} présences enregistrées
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Étudiant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Heure
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Méthode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Salle
              </th>
              {showActions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {attendanceArray.map((record) => (
              <tr key={record.studentId} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900">
                        {record.student_name || record.name || 'Inconnu'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.studentId}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center text-sm">
                    <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                    {record.time}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    record.method === 'RFID'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {record.method === 'RFID' ? (
                      <>
                        <CreditCardIcon className="h-4 w-4 mr-1" />
                        RFID
                      </>
                    ) : (
                      <>
                        <FingerPrintIcon className="h-4 w-4 mr-1" />
                        Empreinte
                      </>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {record.room || 'N/A'}
                </td>
                {showActions && onAction && (
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onAction(record)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Supprimer
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Résumé */}
      <div className="px-6 py-4 bg-gray-50 border-t">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Mis à jour: {new Date().toLocaleTimeString()}
          </div>
          <div className="text-sm">
            <span className="font-medium">Total:</span> {attendanceArray.length} présences
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTable;