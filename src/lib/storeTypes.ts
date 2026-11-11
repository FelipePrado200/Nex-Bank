/** Shapes returned by /api/store/orders (money is a string of centavos). */
export interface StoreOrderItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  icon: string;
  unitPriceCents: string;
  quantity: number;
}

export interface StoreOrder {
  id: string;
  code: string;
  status: string;
  paymentMethod: "ACCOUNT" | "CARD";
  cardLastFour: string | null;
  totalCents: string;
  createdAt: string;
  items: StoreOrderItem[];
}
