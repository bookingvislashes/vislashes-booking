"use client";

import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useEffect, useRef, useState } from "react";

const products = [
  { name: "Chemistry", price: "$15", image: "/images/product-lash.png" },
  { name: "Passion", price: "$15", image: "/images/product-lash.png" },
  { name: "Connection", price: "$15", image: "/images/product-lash.png" },
];

export function ProductCards() {
  const { addItem } = useCart();
  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleAdd = (product: (typeof products)[number]) => {
    addItem(product);
    setAddedProduct(product.name);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setAddedProduct(null), 1200);
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
            {/* Add to Cart. Sits open by default and only becomes a
                slide-up-on-hover affordance where a real pointer exists —
                Tailwind v4 gates `group-hover` behind `@media (hover: hover)`,
                so the old hover-only version left the button parked off-screen
                on every touch device and there was no way to add to cart at
                all. `group-focus-within` does the same job for the keyboard. */}
            <button
              onClick={() => handleAdd(product)}
              className="absolute inset-x-0 bottom-0 h-control bg-brand-brown/95 text-white font-sans font-semibold text-[14px] transition-transform duration-300 motion-reduce:transition-none [@media(hover:hover)]:translate-y-full [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-focus-within:translate-y-0"
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
