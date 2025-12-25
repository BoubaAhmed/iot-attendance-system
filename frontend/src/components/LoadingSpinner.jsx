import React from 'react';
import { FiLoader } from 'react-icons/fi';

const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        <FiLoader className="absolute inset-0 m-auto h-8 w-8 text-blue-600 animate-pulse" />
      </div>
      <p className="mt-4 text-gray-600 font-medium">Chargement du tableau de bord...</p>
      <p className="text-sm text-gray-500 mt-2">Récupération des données en temps réel</p>
    </div>
  );
};

export default LoadingSpinner;