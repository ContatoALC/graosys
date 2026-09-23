import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import { formatDate } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface TableForm {
  name: string;
  product: string;
  crop: string;
  description: string;
}

export function AdminTablesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<TableForm>();

  function load() {
    api
      .get("/api/product-tables")
      .then((r) => setTables(r.data))
      .catch(console.error);
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    reset();
    setEditingId(null);
    setShowDialog(true);
  }
  function openEdit(t: any) {
    reset(t);
    setEditingId(t.id);
    setShowDialog(true);
  }

  async function onSubmit(data: TableForm) {
    try {
      if (editingId) {
        await api.patch(`/api/product-tables/${editingId}`, data);
      } else {
        await api.post("/api/product-tables", data);
      }
      setShowDialog(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao salvar");
    }
  }

  async function del(id: string) {
    if (!confirm("Remover mesa?")) return;
    await api.delete(`/api/product-tables/${id}`);
    load();
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Mesas"
        description="Grupo de mesas por produto e safra"
        action={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Mesa
          </Button>
        }
      />
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Safra</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Table2 className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Nenhuma mesa cadastrada
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  tables.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.product}</TableCell>
                      <TableCell>{t.crop}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.description}
                      </TableCell>
                      <TableCell>{formatDate(t.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(t)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => del(t.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Mesa" : "Nova Mesa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Input {...register("product", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Safra</Label>
              <Input
                placeholder="ex: 2024/2025"
                {...register("crop", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input {...register("description")} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
