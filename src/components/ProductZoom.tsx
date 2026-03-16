'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface ProductZoomProps {
  imageUrl: string;
  alt: string;
}

const ProductZoom: React.FC<ProductZoomProps> = ({ imageUrl, alt }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  return (
    <div
      className="relative overflow-hidden cursor-zoom-in"
      onMouseEnter={() => setIsZoomed(true)}
      onMouseLeave={() => setIsZoomed(false)}
      onMouseMove={handleMouseMove}
    >
      <Image
        src={imageUrl}
        alt={alt}
        width={500}
        height={500}
        className="w-full h-auto transition-transform duration-300"
        style={{
          transform: isZoomed ? `scale(2)` : 'scale(1)',
          transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
        }}
      />
    </div>
  );
};

export default ProductZoom;

