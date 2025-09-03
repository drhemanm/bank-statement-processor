import React from 'react';
import { RotateCcw } from 'lucide-react';

const FlippableCard = ({ 
  cardId, 
  icon: Icon, 
  frontTitle, 
  frontValue, 
  frontSubtitle, 
  backContent, 
  color = 'blue',
  isFlipped,
  onToggleFlip 
}) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600'
  };

  const iconColorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
    indigo: 'text-indigo-500'
  };
  
  return (
    <div 
      className="relative w-full h-40 cursor-pointer group"
      style={{ perspective: '1000px' }}
      onClick={() => onToggleFlip(cardId)}
    >
      <div 
        className={`absolute inset-0 w-full h-full transition-transform duration-700 ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of card */}
        <div 
          className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border flex items-center hover:shadow-md transition-shadow"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Icon className={`h-8 w-8 ${iconColorClasses[color]} mr-3 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className={`text-2xl font-bold ${colorClasses[color]} truncate`}>{frontValue}</div>
            <div className="text-sm text-gray-600 truncate">{frontSubtitle}</div>
          </div>
          <RotateCcw className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        {/* Back of card */}
        <div 
          className="absolute inset-0 w-full h-full bg-white rounded-lg p-4 shadow-sm border"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-800 text-sm">{frontTitle} Details</h4>
              <RotateCcw className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-1 text-xs">
                {backContent.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-600">{item.label}</span>
                    <span className={`font-medium ${item.color || 'text-gray-800'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlippableCard;
