import { useState, useEffect, useId } from "react"
import { Users, Plus, Pencil, Trash2, Check, Loader2, AlertTriangle } from "lucide-react"
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
      {/* Header */}
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
        {!loading && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}
          >
            {members.length}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg text-[12px] font-medium"
          style={{ backgroundColor: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.15)", color: "var(--color-loss)" }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[12px]">Loading members...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="rounded-lg transition-all duration-150"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: editingId === member.id || deleteConfirm === member.id
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--border-subtle)",
              }}
            >
              {/* Edit mode */}
              {editingId === member.id ? (
                <div className="px-3.5 py-3 space-y-2.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit(member.id)
                      if (e.key === "Escape") cancelEdit()
                    }}
                    autoFocus
                    className="w-full px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] bg-transparent outline-none"
                    style={{
                      border: "1px solid var(--color-accent)",
                      color: "var(--text-primary)",
                      boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.12)",
                    }}
                    aria-label="Edit member name"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(member.id)}
                      disabled={saving || !editName.trim()}
                      className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200 text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" }}
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200"
                      style={{
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-card)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

              /* Delete confirm mode */
              ) : deleteConfirm === member.id ? (
                <div className="px-3.5 py-3 space-y-2.5">
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px]"
                    style={{ backgroundColor: "rgba(244, 63, 94, 0.06)", border: "1px solid rgba(244, 63, 94, 0.12)" }}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--color-loss)" }} />
                    <span style={{ color: "var(--text-primary)" }}>
                      Delete <strong>{member.name}</strong>? This permanently removes all their holdings and P&L data.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(member.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200 disabled:opacity-40"
                      style={{
                        color: "white",
                        backgroundColor: "var(--color-loss)",
                        border: "1px solid var(--color-loss)",
                      }}
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      {saving ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200"
                      style={{
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-card)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

              /* Normal display mode */
              ) : (
                <div className="flex items-center px-3.5 py-2.5 gap-3">
                  <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {member.name}
                  </span>
                  <button
                    onClick={() => startEdit(member)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md text-[11px] font-medium cursor-pointer transition-all duration-200"
                    style={{
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-color)",
                    }}
                    aria-label={`Edit ${member.name}`}
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(member.id); setEditingId(null) }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md text-[11px] font-medium cursor-pointer transition-all duration-200"
                    style={{
                      color: "var(--color-loss)",
                      border: "1px solid rgba(244, 63, 94, 0.3)",
                    }}
                    aria-label={`Delete ${member.name}`}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add new member */}
          {showAdd ? (
            <div
              className="rounded-lg px-3.5 py-3 space-y-2.5 animate-fade-in"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--color-accent)",
              }}
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
                className="w-full px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] bg-transparent outline-none"
                style={{
                  border: "1px solid var(--color-accent)",
                  color: "var(--text-primary)",
                  boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.12)",
                }}
                aria-label="New member name"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200 text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" }}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add Member
                </button>
                <button
                  onClick={() => { setShowAdd(false); setNewName(""); setError(null) }}
                  className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200"
                  style={{
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-card)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); setDeleteConfirm(null); setError(null) }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] sm:min-h-0 w-full rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-200 hover:brightness-110 text-white"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" }}
            >
              <Plus size={14} />
              Add New Member
            </button>
          )}
        </div>
      )}
    </div>
  )
}
