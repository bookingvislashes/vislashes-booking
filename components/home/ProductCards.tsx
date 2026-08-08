"use client";

import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useState } from "react";

const products = [
  { name: "Chemistry", price: "$15", image: "/images/product-lash.png" },
  { name: "Passion", price: "$15", image: "/images/product-lash.png" },
  { name: "Connection", price: "$15", image: "/images/product-lash.png" },
];

export function ProductCards() {
  const { addItem } = useCart();
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  const handleAdd = (product: (typeof products)[number]) => {
    addItem(product);
    setAddedProduct(product.name);
    setTimeout(() => setAddedProduct(null), 1200);
  };

  return (
    // Three products, so a 2-column tablet grid always orphans one card on its
    // own row. Going to 3 columns at md keeps the set on a single row.
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 lg:gap-[40px]">
      {products.map((product) => (
        <div key={product.name} className="group flex flex-col items-center">
          {/* Product Image */}
          <div className="w-full aspect-[0.78] bg-card-beige relative overflow-hidden">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 373px"
              quality={90}
            />
            {/* Add to Cart overlay on hover */}
            <button
              onClick={() => handleAdd(product)}
              className="absolute inset-x-0 bottom-0 h-[48px] bg-brand-brown/95 text-white font-sans font-semibold text-[14px] translate-y-full group-hover:translate-y-0 transition-transform duration-300 motion-reduce:transition-none cursor-pointer"
            >
              {addedProduct === product.name ? "Added!" : "Add to Cart"}
            </button>
          </div>
          {/* Product Info */}
          <h3 className="font-display text-[22px] sm:text-[26px] lg:text-[28px] text-text-brown text-center mt-4 sm:mt-5 leading-[1.45]">
            {product.name}
          </h3>
          <p className="font-sans text-[18px] sm:text-[20px] lg:text-[22px] text-text-brown text-center mt-1">
            {product.price}
          </p>
        </div>
      ))}
    </div>
  );
}
