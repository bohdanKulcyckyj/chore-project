export interface DraftItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
}

export interface DraftPurchase {
  shop: string;
  purchasedAt: Date;
  total: number;
  items: DraftItem[];
}

export interface ShopParser {
  shop: string;
  detect: (text: string) => boolean;
  parse: (text: string) => DraftPurchase;
}
