import React from 'react';

const StatsCard = ({ title, value, icon: Icon, color, change, trend, detail }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 border-blue-200',
    green: 'bg-green-100 text-green-600 border-green-200',
    purple: 'bg-purple-100 text-purple-600 border-purple-200',
    orange: 'bg-orange-100 text-orange-600 border-orange-200',
    red: 'bg-red-100 text-red-600 border-red-200'
  };

  const trendIcon = {
    up: '↗',
    down: '↘',
    stable: '→'
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{detail}</p>
        {change && (
          <div className="flex items-center text-sm">
            <span className={`mr-1 ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
              {trendIcon[trend]}
            </span>
            <span className="font-medium">{change}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;