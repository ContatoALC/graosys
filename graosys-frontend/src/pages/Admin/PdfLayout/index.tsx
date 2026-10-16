import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, FileText, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/contexts/ConfirmContext";
import { formatDate } from "@/lib/utils";
import { api } from "@/services/api";
import { toast } from "sonner";
import { SimpleSelect } from "@/components/ui/simple-select";

export const LANGUAGE_LABELS: Record<string, string> = { "pt-BR": "Português", en: "Inglês" };

interface TemplateRow { id: string; name: string; language: string; is_default: boolean; active: boolean; updated_at: string }

export function AdminPdfLayoutPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLanguage, setNewLanguage] = useState("pt-BR");
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/api/contract-templates").then((r) => setTemplates(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await api.post("/api/contract-templates", { name: newName, language: newLanguage });
      navigate(`/admin/pdf-layout/${r.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao criar o modelo");
    } finally { setCreating(false); }
  }

  async function action(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); load(); }
    catch (err: any) { toast.error(err.response?.data?.error || "Erro ao alterar o modelo"); }
  }

  async function remove(t: TemplateRow) {
    if (!(await confirm({
      title: `Excluir o modelo "${t.name}"?`,
      description: "Se algum contrato já usa este modelo, ele é arquivado: some da escolha, mas o PDF desses contratos continua igual.",
      confirmText: "Excluir", destructive: true,
    }))) return;
    try {
      const r = await api.delete(`/api/contract-templates/${t.id}`);
      toast.success(r.data.archived ? "Modelo arquivado (já usado em contratos)" : "Modelo excluído");
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || "Erro ao excluir o modelo"); }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Modelos de contrato"
        description="Idioma, campos, cláusulas e visual do PDF de cada tipo de contrato"
        action={<Button onClick={() => { setNewName(""); setNewLanguage("pt-BR"); setShowNew(true); }}><Plus className="mr-2 h-4 w-4" />Novo modelo</Button>}
      />
      <div className="flex-1 p-6">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center"><FileText className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-muted-foreground">Carregando modelos...</p></TableCell></TableRow>
              ) : templates.map((t) => (
                <TableRow key={t.id} className={t.active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {t.name}
                      {t.is_default && <Badge>Padrão</Badge>}
                      {!t.active && <Badge variant="secondary">Arquivado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{LANGUAGE_LABELS[t.language] ?? t.language}</TableCell>
                  <TableCell>{formatDate(t.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => navigate(`/admin/pdf-layout/${t.id}`)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Duplicar" onClick={() => action(() => api.post(`/api/contract-templates/${t.id}/duplicate`), "Modelo duplicado")}><Copy className="h-4 w-4" /></Button>
                      {!t.is_default && t.active && (
                        <Button variant="ghost" size="icon" title="Tornar padrão" onClick={() => action(() => api.post(`/api/contract-templates/${t.id}/default`), `"${t.name}" agora é o modelo padrão`)}><Star className="h-4 w-4" /></Button>
                      )}
                      {!t.active && (
                        <Button variant="ghost" size="icon" title="Reativar" onClick={() => action(() => api.put(`/api/contract-templates/${t.id}`, { active: true }), "Modelo reativado")}><ArchiveRestore className="h-4 w-4" /></Button>
                      )}
                      {!t.is_default && t.active && (
                        <Button variant="ghost" size="icon" title="Arquivar" onClick={() => action(() => api.put(`/api/contract-templates/${t.id}`, { active: false }), "Modelo arquivado")}><Archive className="h-4 w-4" /></Button>
                      )}
                      {!t.is_default && (
                        <Button variant="ghost" size="icon" title="Excluir" className="text-destructive hover:text-destructive" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
        <p className="mt-2 text-xs text-muted-foreground">O modelo padrão vale para os contratos sem modelo escolhido. Cada contrato pode escolher outro na tela do contrato.</p>

      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo modelo de contrato</DialogTitle>
            <DialogDescription>Começa com os campos e textos padrão do idioma e o visual do modelo padrão.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-template-name">Nome</Label>
              <Input id="new-template-name" autoFocus placeholder="ex.: Exportação FOB (inglês)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-template-language">Idioma</Label>
              <SimpleSelect id="new-template-language" value={newLanguage} onValueChange={setNewLanguage}
                options={Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating || !newName.trim()}>Criar e editar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
