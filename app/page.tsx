'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table';
import { MappingEditor, Mapping } from '@/components/MappingEditor';
import type { AnalyzeResponse } from '@/lib/types';

export default function Page() {
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [monthOverride, setMonthOverride] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [requiredMetrics, setRequiredMetrics] = useState<string[]>([]);

  useEffect(() => {
    const loadConfig = async () => {
      const res = await fetch('/api/config');
      const data = await res.json();
      setMapping(data.mapping || {});
      setRequiredMetrics(data.requiredMetrics || []);
    };
    loadConfig();
  }, []);

  const canGenerate = useMemo(() => {
    if (!analysis) return false;
    return analysis.validations.every((v) => v.status === 'pass');
  }, [analysis]);

  const handleAnalyze = async () => {
    if (!wordFile || !excelFile) {
      setError('Please upload both Word and Excel files.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('word', wordFile);
      formData.append('excel', excelFile);
      if (monthOverride) formData.append('monthOverride', monthOverride);
      if (mapping) formData.append('mappingOverride', JSON.stringify(mapping));

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analyze failed.');
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message ?? 'Analyze failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!wordFile || !excelFile) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('word', wordFile);
      formData.append('excel', excelFile);
      if (monthOverride) formData.append('monthOverride', monthOverride);
      if (mapping) formData.append('mappingOverride', JSON.stringify(mapping));

      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        setAnalysis((prev) => (prev ? { ...prev, validations: data.validations ?? prev.validations } : prev));
        throw new Error(data.error || 'Generation blocked.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `updated-${analysis?.month ?? 'report'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message ?? 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge className="badge" tone="neutral">Deterministic · Fail-Closed</Badge>
        <h1 className="font-display text-4xl font-semibold text-ink">Report Assistant</h1>
        <p className="max-w-2xl text-base text-muted">
          Upload the current Word report and the previous month Excel. Analyze first, then generate the updated Excel only when all validations pass.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Word Report (.docx)</CardTitle>
            <CardDescription>Current month Word report with metrics and case tables.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input type="file" accept=".docx" onChange={(e) => setWordFile(e.target.files?.[0] ?? null)} />
            {wordFile && <p className="mt-2 text-xs text-muted">Selected: {wordFile.name}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Previous Excel (.xlsx)</CardTitle>
            <CardDescription>Last month workbook. Must not contain macros or pivots.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input type="file" accept=".xlsx,.xlsm" onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)} />
            {excelFile && <p className="mt-2 text-xs text-muted">Selected: {excelFile.name}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analyze & Generate</CardTitle>
          <CardDescription>System is deterministic-first and will fail-closed on any ambiguity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className="text-xs uppercase text-muted">Month Override (YYYY-MM)</label>
              <Input value={monthOverride} onChange={(e) => setMonthOverride(e.target.value)} placeholder="2026-01" />
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>Analyze</Button>
            <Button onClick={handleGenerate} disabled={loading || !canGenerate}>Generate Excel</Button>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          {analysis && (
            <div className="mt-4 text-sm text-muted">Detected month: <span className="font-semibold text-ink">{analysis.month ?? 'Unresolved'}</span></div>
          )}
        </CardContent>
      </Card>

      <MappingEditor requiredMetrics={requiredMetrics} mapping={mapping} onChange={setMapping} />

      {analysis && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation Checklist</CardTitle>
              <CardDescription>All checks must pass to enable generation.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.validations.map((validation) => (
                  <div key={validation.id} className="flex flex-col gap-1 rounded-xl border border-ink/10 bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={validation.status === 'pass' ? 'success' : 'danger'}>
                        {validation.status.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium text-ink">{validation.message}</span>
                    </div>
                    {validation.details && <p className="text-xs text-muted">{validation.details}</p>}
                    {validation.location && <p className="text-xs text-muted">{validation.location}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extracted Summary Metrics</CardTitle>
              <CardDescription>Deterministic values with provenance.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.metrics.map((metric) => (
                  <div key={metric.name} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-ink">{metric.name}</div>
                      <div className="text-lg font-semibold text-ink">{metric.value}</div>
                    </div>
                    <p className="mt-1 text-xs text-muted">{metric.source.textSnippet}</p>
                    {metric.source.type === 'table' && (
                      <p className="text-xs text-muted">Table {metric.source.tableIndex} Row {metric.source.row} Col {metric.source.col}</p>
                    )}
                  </div>
                ))}
                {analysis.metrics.length === 0 && <p className="text-sm text-muted">No metrics extracted.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cases Preview (First 50)</CardTitle>
              <CardDescription>Normalized fields extracted from tables.</CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.casesPreview.length === 0 ? (
                <p className="text-sm text-muted">No case rows detected.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        {Object.keys(analysis.casesPreview[0].normalized).map((key) => (
                          <TableHeaderCell key={key}>{key}</TableHeaderCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analysis.casesPreview.map((row, index) => (
                        <TableRow key={index}>
                          {Object.keys(row.normalized).map((key) => (
                            <TableCell key={key}>{row.normalized[key]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

