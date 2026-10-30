import React from 'react';
import { ProductsPage } from './ProductsPage';

/**
 * Backward compatibility wrapper for /portfolio route.
 * Renders the new database-driven ProductsPage.
 */
export const PortfolioPage: React.FC = () => {
  return <ProductsPage />;
};

export default PortfolioPage;
