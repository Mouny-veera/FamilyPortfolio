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
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setError(null) }}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-150 hover:brightness-110 text-white"
          style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" }}
        >
          <Plus size={13} />
          Add
        </button>
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
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg group"
              style={{ backgroundColor: editingId === member.id ? "var(--bg-elevated)" : undefined }}
            >
              {editingId === member.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit(member.id)
                      if (e.key === "Escape") cancelEdit()
                    }}
                    autoFocus
                    className="flex-1 px-2 py-1 rounded-md text-[13px] bg-transparent outline-none"
                    style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    aria-label="Edit member name"
                  />
                  <button
                    onClick={() => handleEdit(member.id)}
                    disabled={saving}
                    className="p-1.5 rounded-md cursor-pointer transition-all duration-150"
                    style={{ color: "var(--color-profit)" }}
                    aria-label="Save"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 rounded-md cursor-pointer transition-all duration-150"
                    style={{ color: "var(--text-muted)" }}
                    aria-label="Cancel"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : deleteConfirm === member.id ? (
                <>
                  <span className="flex-1 text-[12px]" style={{ color: "var(--color-loss)" }}>
                    Delete "{member.name}"? This removes all their holdings and P&L data.
                  </span>
                  <button
                    onClick={() => handleDelete(member.id)}
                    disabled={saving}
                    className="px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer"
                    style={{ backgroundColor: "rgba(244, 63, 94, 0.1)", color: "var(--color-loss)" }}
                  >
                    {saving ? "..." : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {member.name}
                  </span>
                  <button
                    onClick={() => startEdit(member)}
                    className="p-1.5 rounded-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={`Edit ${member.name}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(member.id)}
                    className="p-1.5 rounded-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150"
                    style={{ color: "var(--color-loss)" }}
                    aria-label={`Delete ${member.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add new member form */}
          {showAdd && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg animate-fade-in"
              style={{ backgroundColor: "var(--bg-elevated)" }}
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
                className="flex-1 px-2 py-1 rounded-md text-[13px] bg-transparent outline-none"
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                aria-label="New member name"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="p-1.5 rounded-md cursor-pointer transition-all duration-150 disabled:opacity-40"
                style={{ color: "var(--color-profit)" }}
                aria-label="Add member"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName(""); setError(null) }}
                className="p-1.5 rounded-md cursor-pointer transition-all duration-150"
                style={{ color: "var(--text-muted)" }}
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
        Add members for each demat account (e.g. "Mouny Axis", "Mouny HDFC"). Edit names anytime — holdings stay linked.
      </p>
    </div>
  )
}
