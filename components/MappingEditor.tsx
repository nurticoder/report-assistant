'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';

export type Mapping = Record<string, { sheet: string; cell: string }>;

export function MappingEditor({
  requiredMetrics,
  mapping,
  onChange
}: {
  requiredMetrics: string[];
  mapping: Mapping;
  onChange: (next: Mapping) => void;
}) {
  const updateField = (metric: string, field: 'sheet' | 'cell', value: string) => {
    const next = {
      ...mapping,
      [metric]: {
        sheet: mapping[metric]?.sheet ?? '',
        cell: mapping[metric]?.cell ?? '',
        [field]: value
      }
    };
    onChange(next);
  };

  const saveMapping = async () => {
    await fetch('/api/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping)
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Metric Mapping Editor</h3>
          <p className="text-sm text-muted">Fill in missing sheet and cell addresses. Saving updates config/metricCellMap.json.</p>
        </div>
        <Button variant="outline" onClick={saveMapping}>Save mapping</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Metric</TableHeaderCell>
              <TableHeaderCell>Sheet</TableHeaderCell>
              <TableHeaderCell>Cell</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requiredMetrics.map((metric) => (
              <TableRow key={metric}>
                <TableCell className="font-medium">{metric}</TableCell>
                <TableCell>
                  <Input
                    value={mapping[metric]?.sheet ?? ''}
                    onChange={(event) => updateField(metric, 'sheet', event.target.value)}
                    placeholder="Sheet name"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={mapping[metric]?.cell ?? ''}
                    onChange={(event) => updateField(metric, 'cell', event.target.value.toUpperCase())}
                    placeholder="Cell (e.g., B12)"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

