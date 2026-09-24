import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Users, Eye, Building2, User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { formatCnpjCpf } from "@/lib/utils";

export function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function load(q = "") {
    setIsLoading(true);
    api.get("/api/clients", { params: { search: q || undefined, limit: 50 } })
      .then((r) => { setClients(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Clientes"
        description={`${total} clientes cadastrados`}
        action={
          <Button asChild>
            <Link to="/clients/new"><Plus className="mr-2 h-4 w-4" />Novo Cliente</Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(search)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => load(search)}>Buscar</Button>
          {search && <Button variant="ghost" onClick={() => { setSearch(""); load(""); }}>Limpar</Button>}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome / Razão Social</TableHead>
                  <TableHead>Apelido</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>Cidade / UF</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code_client}</TableCell>
                      <TableCell>
                        {c.kind === "PJ"
                          ? <Building2 className="h-4 w-4 text-muted-foreground" />
                          : <User className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.nickname}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCnpjCpf(c.cnpj_cpf)}</TableCell>
                      <TableCell>{c.city}{c.state ? ` / ${c.state}` : ""}{c.country && c.country !== "Brasil" ? ` - ${c.country}` : ""}</TableCell>
                      <TableCell>
                        <Badge variant={c.situation === "active" ? "success" : "secondary"}>
                          {c.situation === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/clients/${c.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
