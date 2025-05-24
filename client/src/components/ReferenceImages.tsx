import React from 'react';

interface ReferenceImagesProps {
  images: string[];
  loading?: boolean;
}

const ReferenceImages: React.FC<ReferenceImagesProps> = ({ images, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500"></div>
        <span className="ml-4 text-white/80">Загрузка референсов...</span>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="text-white/60 italic text-center py-4">
        Нет подходящих референсов для этого рисунка.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h4 className="text-lg font-semibold text-white mb-2">Референсы</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((imageUrl, index) => (
          <div
            key={index}
            className="relative rounded-xl overflow-hidden shadow-lg group bg-white/10 flex items-center justify-center aspect-[4/3] max-w-[140px] mx-auto md:max-w-[120px]"
          >
            <img
              src={imageUrl}
              alt={`Reference ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl"
              onError={e => (e.currentTarget.style.opacity = '0.3')}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReferenceImages; 
