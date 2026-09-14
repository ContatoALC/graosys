import { useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export function ReportsPage() {
  const [filters, setFilters] = useState({
    crop: "",
    product: "",
    start_date: "",
    end_date: "",
  });
  const [result, setResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runReport() {
    setIsLoading(true);
    try {
      const { data } = await api.get("/api/contracts/report", {
        params: filters,
      });
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  function getTableRows() {
    if (!result) return [];
    return result.contracts.map((c: any) => [
      c.number_contract,
      c.name_product,
      c.crop,
      `${c.quantity} ${c.type_quantity}`,
      formatCurrency(c.total_contract_value),
      formatCurrency(c.commission_contract),
      formatDate(c.contract_emission_date),
    ]);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório de Contratos", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [
        [
          "Nº Contrato",
          "Produto",
          "Safra",
          "Qtd.",
          "Vlr. Total",
          "Comissão",
          "Data",
        ],
      ],
      body: getTableRows(),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] },
    });

    doc.save("relatorio-contratos.pdf");
  }

  function exportXLSX() {
    const headers = [
      "Nº Contrato",
      "Produto",
      "Safra",
      "Qtd.",
      "Vlr. Total",
      "Comissão",
      "Data",
    ];
    const rows = getTableRows();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contratos");
    XLSX.writeFile(wb, "relatorio-contratos.xlsx");
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Relatórios"
        description="Análise de contratos e comissões"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Safra</Label>
                <Input
                  placeholder="ex: 2024/2025"
                  value={filters.crop}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, crop: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Input
                  placeholder="ex: soja"
                  value={filters.product}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, product: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={runReport} disabled={isLoading}>
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? "Gerando..." : "Gerar Relatório"}
              </Button>
              {result && (
                <>
                  <Button variant="outline" onClick={exportPDF}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                  <Button variant="outline" onClick={exportXLSX}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar XLSX
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {result && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">
                    Total de Contratos
                  </p>
                  <p className="text-2xl font-bold">{result.summary.count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">
                    Valor Total dos Contratos
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(result.summary.totalValue)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">
                    Comissão Total
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(result.summary.totalCommission)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Contrato</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Safra</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Vlr. Total</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.contracts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.number_contract}
                        </TableCell>
                        <TableCell>{c.name_product}</TableCell>
                        <TableCell>{c.crop}</TableCell>
                        <TableCell className="text-right">
                          {c.quantity} {c.type_quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(c.total_contract_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(c.commission_contract)}
                        </TableCell>
                        <TableCell>
                          {formatDate(c.contract_emission_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {!result && !isLoading && (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Configure os filtros e clique em "Gerar Relatório"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
