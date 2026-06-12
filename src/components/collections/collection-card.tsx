import Link from 'next/link'
import { CollectionCover } from './collection-cover'
import type { CollectionOverviewItem } from '@/hooks/use-collections'

interface CollectionCardProps {
  collection: CollectionOverviewItem
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Link href={`/collections/${collection.id}`} className="group block">
      <div className="rounded-xl overflow-hidden border bg-card hover:shadow-md transition-all hover:-translate-y-0.5">
        <CollectionCover
          images={collection.collage_images}
          name={collection.name}
          mode="collage"
          totalCount={collection.prompt_count}
          className="aspect-square w-full"
        />
        <div className="p-3">
          <h3 className="font-medium text-sm truncate">{collection.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {collection.prompt_count}{' '}
            {collection.prompt_count === 1 ? 'Prompt' : 'Prompts'}
          </p>
        </div>
      </div>
    </Link>
  )
}
