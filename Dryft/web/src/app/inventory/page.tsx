'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';
import { InventoryItem, ItemType } from '@/types';

const ITEM_TYPES: { label: string; value: ItemType | null }[] = [
  { label: 'All', value: null },
  { label: 'Avatars', value: 'avatar' },
  { label: 'Outfits', value: 'outfit' },
  { label: 'Toys', value: 'toy' },
  { label: 'Effects', value: 'effect' },
  { label: 'Gestures', value: 'gesture' },
];

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ItemType | null>(null);
  const [equippedItems, setEquippedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadInventory();
  }, [selectedType]);

  const loadInventory = async () => {
    setIsLoading(true);

    let endpoint = '/v1/inventory';
    if (selectedType) {
      endpoint += `?type=${selectedType}`;
    }

    const response = await apiClient.get<{ items: InventoryItem[] }>(endpoint);

    if (response.success && response.data) {
      setItems(response.data.items || []);
      const equipped = new Set<string>();
      response.data.items?.forEach((item) => {
        if (item.is_equipped) equipped.add(item.id);
      });
      setEquippedItems(equipped);
    }

    setIsLoading(false);
  };

  const toggleEquip = async (item: InventoryItem) => {
    const isCurrentlyEquipped = equippedItems.has(item.id);
    const endpoint = isCurrentlyEquipped
      ? `/v1/inventory/${item.id}/unequip`
      : `/v1/inventory/${item.id}/equip`;

    const response = await apiClient.post(endpoint, {});

    if (response.success) {
      setEquippedItems((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyEquipped) {
          newSet.delete(item.id);
        } else {
          // For single-equip types like avatar, unequip others
          if (item.item_type === 'avatar') {
            items.forEach((i) => {
              if (i.item_type === 'avatar') newSet.delete(i.id);
            });
          }
          newSet.add(item.id);
        }
        return newSet;
      });
    }
  };

  const filteredItems = selectedType
    ? items.filter((item) => item.item_type === selectedType)
    : items;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/store" className="text-muted hover:text-white transition-colors">
              Store
            </Link>
            <Link href="/inventory" className="text-white font-medium">
              Inventory
            </Link>
            <Link href="/profile" className="text-muted hover:text-white transition-colors">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">My Inventory</h1>
          <Link href="/store" className="btn-secondary">
            Browse Store
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {ITEM_TYPES.map((type) => (
            <Button
              key={type.label}
              onClick={() => setSelectedType(type.value)}
              variant="ghost"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedType === type.value
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-white'
              }`}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner className="h-12 w-12" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted mb-4">
              {selectedType ? `No ${selectedType}s in your inventory` : 'Your inventory is empty'}
            </p>
            <Link href="/store" className="btn-primary">
              Browse Store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                isEquipped={equippedItems.has(item.id)}
                onToggleEquip={() => toggleEquip(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryCard({
  item,
  isEquipped,
  onToggleEquip,
}: {
  item: InventoryItem;
  isEquipped: boolean;
  onToggleEquip: () => void;
}) {
  return (
    <Card>
      <Link href={`/store/${item.item_id}`}>
        <div className="relative aspect-square bg-border">
          {item.thumbnail_url && (
            <Image
              src={item.thumbnail_url}
              alt={item.name || 'Item'}
              fill
              className="object-cover"
            />
          )}
          {isEquipped && (
            <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
              Equipped
            </span>
          )}
        </div>
      </Link>
      <div className="p-3">
        <h3 className="font-medium text-white truncate">{item.name}</h3>
        <p className="text-xs text-muted capitalize mb-3">{item.item_type}</p>
        <Button
          onClick={onToggleEquip}
          variant={isEquipped ? 'secondary' : 'primary'}
          className={`w-full py-2 text-sm font-medium ${
            isEquipped ? 'text-muted hover:text-white' : ''
          }`}
        >
          {isEquipped ? 'Unequip' : 'Equip'}
        </Button>
      </div>
    </Card>
  );
}
