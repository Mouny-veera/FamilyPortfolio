import { useState, useEffect, useId } from "react"
import { Users, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react"
import { api, type Member } from "@/lib/api"

export function MembersSection() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const uid = useId()

  const loadMembers = async () => {
    try {
      const data = await api.getMembers()
      setMembers(data)
    } catch {
      setError("Failed to load members")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMembers() }, [])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      await api.createMember(name)
      setNewName("")
      setShowAdd(false)
      await loadMembers()
      window.dispatchEvent(new Event("members-changed"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id: number) => {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      await api.updateMember(id, name)
      setEditingId(null)
      setEditName("")
      await loadMembers()
      window.dispatchEvent(new Event("members-changed"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update member")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setSaving(true)
    setError(null)
    try {
      await api.deleteMember(id)
      setDeleteConfirm(null)
      await loadMembers()
      window.dispatchEvent(new Event("members-changed"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete member")
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (member: Member) => {
    setEditingId(member.id)
    setEditName(member.name)
    setShowAdd(false)
    setDeleteConfirm(null)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setError(null)
  }

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    boxShadow: "var(--shadow-card)",
  }

  return (
    <div className="rounded-xl p-5" style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 100%)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
        >
          <Users size={14} strokeWidth={1.5} style={{ color: "var(--color-profit)" }} />
        </div>
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Family Members
        </h2>
        <span className="text-[11px] font-medium ml-auto" style={{ color: "var(--text-muted)" }}>
          {!loading && `${members.length} member${members.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-[12px] font-medium"
          style={{ backgroundColor: "rgba(244, 63, 94, 0.08)", color: "var(--color-loss)" }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[12px]">Loading members...</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="rounded-lg transition-all duration-150"
              style={{
                backgroundColor: editingId === member.id || deleteConfirm === member.id ? "var(--bg-elevated)" : undefined,
                border: editingId === member.id || deleteConfirm === member.id ? "1px solid var(--border-subtle)" : "1px solid transparent",
              }}
            >
              {editingId === member.id ? (
                <div className="px-3 py-2.5 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit(member.id)
                      if (e.key === "Escape") cancelEdit()
                    }}
                    autoFocus
                    className="w-full px-2.5 py-1.5 rounded-md text-[13px] bg-transparent outline-none"
                    style={{ border: "1px solid var(--color-accent)", color: "var(--text-primary)", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.15)" }}
                    aria-label="Edit member name"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(member.id)}
                      disabled={saving || !editName.trim()}
                      className="flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150 text-white disabled:opacity-40"
                      style={{ background: "var(--gradient-accent)" }}
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-2 py-1.5 min-h-[36px] rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : deleteConfirm === member.id ? (
                <div className="px-3 py-2.5 space-y-2">
                  <p className="text-[12px]" style={{ color: "var(--color-loss)" }}>
                    Delete <strong>{member.name}</strong>? This removes all their holdings and P&L data.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(member.id)}
                      disabled={saving}
                      className="flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150"
                      style={{ backgroundColor: "rgba(244, 63, 94, 0.1)", color: "var(--color-loss)", border: "1px solid rgba(244, 63, 94, 0.2)" }}
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {saving ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2.5 py-1.5 min-h-[36px] rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-2">
                  <span className="text-[13px] font-medium mr-2" style={{ color: "var(--text-primary)" }}>
                    {member.name}
                  </span>
                  <button
                    onClick={() => startEdit(member)}
                    className="flex items-center gap-1 px-2 py-1 min-h-[32px] rounded-md text-[11px] cursor-pointer transition-all duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={`Edit ${member.name}`}
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(member.id); setEditingId(null) }}
                    className="flex items-center gap-1 px-2 py-1 min-h-[32px] rounded-md text-[11px] cursor-pointer transition-all duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={`Delete ${member.name}`}
                  >
                    <Trash2 size={11} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add new member */}
          {showAdd ? (
            <div
              className="rounded-lg px-3 py-2.5 space-y-2 animate-fade-in"
              style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
            >
              <input
                id={`${uid}-new-member`}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                  if (e.key === "Escape") { setShowAdd(false); setNewName("") }
                }}
                placeholder="e.g. Mouny Axis, Mouny HDFC"
                autoFocus
                className="w-full px-2.5 py-1.5 rounded-md text-[13px] bg-transparent outline-none"
                style={{ border: "1px solid var(--color-accent)", color: "var(--text-primary)", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.15)" }}
                aria-label="New member name"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150 text-white disabled:opacity-40"
                  style={{ background: "var(--gradient-accent)" }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </button>
                <button
                  onClick={() => { setShowAdd(false); setNewName(""); setError(null) }}
                  className="px-2 py-1.5 min-h-[36px] rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); setDeleteConfirm(null); setError(null) }}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] w-full rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              style={{ color: "var(--color-accent)", border: "1px dashed var(--border-color)" }}
            >
              <Plus size={14} />
              Add new member
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        Add members for each demat account (e.g. "Mouny Axis", "Mouny HDFC"). Edit names anytime — holdings stay linked.
      </p>
    </div>
  )
}
