import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { useForm } from "react-hook-form";
import { useConfirm } from "@/contexts/ConfirmContext";
import { toast } from "sonner";

interface ProductForm { product_type: string; name: string; quality: string; observation: string; template_id: string; }
interface TemplateOption { id: string; name: string; language: string; is_default: boolean; active: boolean }

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminProductsPage() {
  const confirm = useConfirm();
  const [products, setProducts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, watch } = useForm<ProductForm>();

  function load() { api.get("/api/products").then((r) => setProducts(r.data)).catch(console.error); }
  useEffect(() => {
    load();
    api.get("/api/contract-templates").then((r) => setTemplates(r.data)).catch(console.error);
  }, []);

  function openNew() { reset({ template_id: "" }); setEditingId(null); setShowDialog(true); }
  function openEdit(p: any) { reset({ ...p, template_id: p.template_id ?? "" }); setEditingId(p.id); setShowDialog(true); }
  const templateName = (id?: string | null) => templates.find((t) => t.id === id)?.name;
  // Modelos para escolher: os ativos que não são o padrão e o que o produto já usa (mesmo arquivado).
  const templateOptions = templates.filter((t) => t.id === watch("template_id") || (t.active && !t.is_default));

  async function onSubmit(data: ProductForm) {
    try {
      if (editingId) { await api.patch(`/api/products/${editingId}`, data); }
      else { await api.post("/api/products", data); }
      toast.success(editingId ? "Produto atualizado" : "Produto criado");
      setShowDialog(false); load();
    } catch (e: any) { toast.error(e.response?.data?.error || "Erro ao salvar"); }
  }

  async function del(id: string) {
    if (!(await confirm({ title: "Remover produto?", confirmText: "Remover", destructive: true }))) return;
    await api.delete(`/api/products/${id}`); toast.success("Produto removido"); load();
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Produtos" description="Grãos e commodities negociadas" action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Produto</Button>} />
      <div className="flex-1 p-6">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Qualidade</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Modelo de contrato</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Package className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-muted-foreground">Nenhum produto</p></TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.product_type}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.quality}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.observation}</TableCell>
                  <TableCell className="text-sm">{templateName(p.template_id) ?? <span className="text-muted-foreground">Padrão</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Código</Label><Input {...register("product_type", { required: true })} /></div>
            <div className="space-y-2"><Label>Nome</Label><Input {...register("name", { required: true })} /></div>
            <div className="space-y-2"><Label>Qualidade</Label><Input {...register("quality")} /></div>
            <div className="space-y-2"><Label>Observação</Label><Input {...register("observation")} /></div>
            <div className="space-y-2">
              <Label htmlFor="product-template">Modelo de contrato</Label>
              <select id="product-template" key={templates.length} className={selectClass} {...register("template_id")}>
                <option value="">Padrão da corretora</option>
                {templateOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {t.language === "en" ? "Inglês" : "Português"}{t.active ? "" : " (arquivado)"}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Contrato novo deste produto já vem com este modelo escolhido (dá para trocar no contrato).</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
