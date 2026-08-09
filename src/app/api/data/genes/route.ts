import { getGenesMetadata } from '@/lib/server/geneDatabase';

export const runtime = 'nodejs';

const GENE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const MAX_GENES_PER_REQUEST = 25;

export async function GET(request: Request) {
  const rawGenes = new URL(request.url).searchParams.get('genes') ?? '';
  if (!rawGenes || rawGenes.length > 1_625) {
    return Response.json({ error: 'A bounded genes query parameter is required' }, { status: 400 });
  }

  const genes = [...new Set(rawGenes.split(',').map((gene) => gene.trim()).filter(Boolean))];
  if (
    genes.length === 0 ||
    genes.length > MAX_GENES_PER_REQUEST ||
    genes.some((gene) => !GENE_PATTERN.test(gene))
  ) {
    return Response.json({ error: `Provide 1-${MAX_GENES_PER_REQUEST} valid gene symbols` }, { status: 400 });
  }

  try {
    const metadata = await getGenesMetadata(genes);
    return Response.json(
      { genes: metadata },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    console.error('Unable to read gene metadata database', error);
    return Response.json({ error: 'Gene metadata is temporarily unavailable' }, { status: 503 });
  }
}
