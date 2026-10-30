import React, { useState } from 'react';
import type { Product } from '../../types';
import { api } from '../../lib/api';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ProductDeleteModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess: (productName: string) => void;
  onError: (errorMessage: string) => void;
}

export const ProductDeleteModal: React.FC<ProductDeleteModalProps> = ({
  isOpen,
  product,
  onClose,
  onSuccess,
  onError,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !product) return null;

  const handleConfirmDelete = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      await api.deleteProduct(product.id);
      onSuccess(product.name);
      onClose();
    } catch (err: any) {
      onError(err.message || `Failed to delete "${product.name}". Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in">
      <div className="max-w-md w-full bg-[#1A191F] border border-red-500/40 rounded-xl shadow-2xl p-6 sm:p-7 relative overflow-hidden">
        {/* Subtle Ambient Red Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-[#96929A] hover:text-[#F4F0E8] p-1.5 rounded transition-colors disabled:opacity-40 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl uppercase tracking-tight text-[#F4F0E8]">
              Delete Product
            </h3>
            <p className="text-xs text-[#96929A] mt-1">
              Are you sure you want to permanently remove this product from the platform?
            </p>
          </div>
        </div>

        {/* Product Summary Box */}
        <div className="p-3.5 bg-[#101014] border border-[#39363A] rounded-lg mb-6 flex items-center gap-3">
          <img
            src={product.cover_image || '/brand/karsh-tech-k.png'}
            alt={product.name}
            className="w-12 h-12 rounded object-cover border border-[#39363A] bg-[#1A191F] flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="font-bold text-sm text-[#F4F0E8] truncate">{product.name}</div>
            <div className="text-[10px] font-mono-code text-[#FF5A36] uppercase tracking-wider">
              {product.category} • {product.status}
            </div>
            <div className="text-[10px] font-mono-code text-[#96929A] truncate">
              slug: /{product.slug}
            </div>
          </div>
        </div>

        <p className="text-xs text-red-300/80 mb-6 font-mono-code">
          Warning: This action will immediately unpublish and delete this product from the database.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#39363A]/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-[#C2BEC1] hover:text-[#F4F0E8] border border-[#39363A] hover:bg-[#242329] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-red-600/30 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
