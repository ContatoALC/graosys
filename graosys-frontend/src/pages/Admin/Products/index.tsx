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

interface ProductForm { product_type: string; name: string; quality: string; observation: string; }

export function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<ProductForm>();

  function load() { api.get("/api/products").then((r) => setProducts(r.data)).catch(console.error); }
  useEffect(() => { load(); }, []);

  function openNew() { reset(); setEditingId(null); setShowDialog(true); }
  function openEdit(p: any) { reset(p); setEditingId(p.id); setShowDialog(true); }

  async function onSubmit(data: ProductForm) {
    try {
      if (editingId) { await api.patch(`/api/products/${editingId}`, data); }
      else { await api.post("/api/products", data); }
      setShowDialog(false); load();
    } catch (e: any) { alert(e.response?.data?.error || "Erro ao salvar"); }
  }

  async function del(id: string) {
    if (!confirm("Remover produto?")) return;
    await api.delete(`/api/products/${id}`); load();
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
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Package className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-muted-foreground">Nenhum produto</p></TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.product_type}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.quality}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.observation}</TableCell>
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
