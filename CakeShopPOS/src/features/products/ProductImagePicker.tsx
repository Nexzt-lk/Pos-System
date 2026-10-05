import React, { useState, useRef } from 'react'
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Trash2,
  Link as LinkIcon,
  Check,
  FolderOpen
} from 'lucide-react'
import { message, Input, Tooltip } from 'antd'
import { BAKERY_IMAGE_PRESETS, getProductImageSrc } from '../../lib/imageHelper'
import { compressImageFile, isValidImageFile } from '../../lib/imageUploadHelper'

interface ProductImagePickerProps {
  value?: string // Path, Data URI, URL, or undefined for auto-match
  onChange: (imagePath: string | undefined) => void
  productName?: string
  categoryName?: string
}

export const ProductImagePicker: React.FC<ProductImagePickerProps> = ({
  value,
  onChange,
  productName = '',
  categoryName = ''
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'presets' | 'url'>('upload')
  const [urlInput, setUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAuto = !value || value === ''
  const isDataUri = Boolean(value?.startsWith('data:'))
  const isRemoteUrl = Boolean(value?.startsWith('http://') || value?.startsWith('https://'))
  const isPreset = Boolean(value && !isDataUri && !isRemoteUrl)

  const activeDisplaySrc = getProductImageSrc(value, productName, categoryName)

  // Process an uploaded File
  const handleFileProcess = async (file: File) => {
    if (!isValidImageFile(file)) {
      message.error('Please upload a valid image file (JPEG, PNG, WEBP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      message.error('Image size exceeds 10MB limit')
      return
    }

    try {
      setIsProcessing(true)
      const dataUri = await compressImageFile(file, 600, 0.85)

      // If running inside Electron desktop environment, save directly to local AppData storage!
      if (typeof window !== 'undefined' && window.electronAPI?.saveBase64Image) {
        const prefix = (productName || 'product').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) || 'product'
        const res = await window.electronAPI.saveBase64Image(dataUri, prefix)
        if (res.success && res.relativePath) {
          onChange(res.relativePath)
          // Also cache in browser localStorage for offline/fast preview
          try {
            localStorage.setItem(`pos_img_${res.relativePath}`, dataUri)
          } catch (_) {}
          message.success('Image saved locally to device storage!')
          return
        }
      }

      // If running in browser or fallback, save dataUri directly and cache in localStorage
      onChange(dataUri)
      try {
        const key = `pos_img_${(productName || 'product').toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        localStorage.setItem(key, dataUri)
      } catch (_) {}
      message.success('Product image uploaded and optimized successfully!')
    } catch (err: any) {
      console.error('Failed to compress image:', err)
      message.error(err.message || 'Failed to process image')
    } finally {
      setIsProcessing(false)
    }
  }

  // File input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileProcess(file)
    }
    // Reset file input so selecting the same file triggers change
    if (e.target) {
      e.target.value = ''
    }
  }

  // Electron native file dialog fallback
  const handleSelectFromDesktop = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.selectImageDialog) {
      try {
        const filePath = await window.electronAPI.selectImageDialog()
        if (filePath && window.electronAPI.saveProductImage) {
          setIsProcessing(true)
          const res = await window.electronAPI.saveProductImage(filePath)
          if (res.success && res.relativePath) {
            onChange(res.relativePath)
            message.success('Image saved from PC successfully!')
          } else {
            message.error(res.error || 'Failed to save image')
          }
        }
      } catch (err: any) {
        message.error(err.message || 'Failed to select image from desktop')
      } finally {
        setIsProcessing(false)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileProcess(file)
    }
  }

  // Apply custom URL
  const handleApplyUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) {
      message.warning('Please enter an image URL')
      return
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      message.error('Image URL must start with http:// or https://')
      return
    }
    onChange(trimmed)
    setUrlInput('')
    message.success('Image URL applied!')
  }

  // Sort presets so that items matching the category appear first
  const sortedPresets = [...BAKERY_IMAGE_PRESETS].sort((a, b) => {
    const cName = categoryName.toLowerCase()
    const aMatch = a.categories.some((c) => cName.includes(c.toLowerCase()) || c.toLowerCase().includes(cName))
    const bMatch = b.categories.some((c) => cName.includes(c.toLowerCase()) || c.toLowerCase().includes(cName))
    if (aMatch && !bMatch) return -1
    if (!aMatch && bMatch) return 1
    return 0
  })

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1.5px solid #e2e8f0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14
      }}
    >
      {/* ─── Header: Label & Status ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: '#fce7f3',
              color: '#db2777',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ImageIcon size={14} />
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              Product Image (භාණ්ඩයේ ඡායාරූපය)
            </span>
          </div>
        </div>

        {/* Status Badge & Reset Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isAuto && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#059669',
                background: '#ecfdf5',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Sparkles size={11} /> Auto-Matched
            </span>
          )}

          {isDataUri && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#2563eb',
                background: '#eff6ff',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              📸 Custom Photo
            </span>
          )}

          {isPreset && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#7c3aed',
                background: '#f5f3ff',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid #ddd6fe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              🎨 Preset
            </span>
          )}

          {isRemoteUrl && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#475569',
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid #cbd5e1',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              🌐 Web Link
            </span>
          )}

          {!isAuto && (
            <Tooltip title="Reset to Category Default (ස්වයංක්‍රීය පින්තූරය තෝරන්න)">
              <button
                type="button"
                onClick={() => onChange(undefined)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#dc2626',
                  background: '#fef2f2',
                  padding: '2px 8px',
                  borderRadius: 99,
                  border: '1px solid #fecaca',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={10} /> Reset
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ─── Main Preview & Actions Layout ─── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Large Preview Thumbnail */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          title="Click or Drag & Drop image here"
          style={{
            width: 76,
            height: 76,
            borderRadius: 12,
            border: isDragging ? '2.5px dashed #2563eb' : '2px solid #cbd5e1',
            overflow: 'hidden',
            flexShrink: 0,
            background: isDragging ? '#eff6ff' : '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {activeDisplaySrc ? (
            <img
              src={activeDisplaySrc}
              alt="Product Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isProcessing ? 0.5 : 1
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8'
              }}
            >
              <ImageIcon size={28} />
            </div>
          )}

          {/* Hover overlay hint */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              opacity: isDragging ? 1 : 0,
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => {
              if (!isDragging) e.currentTarget.style.opacity = '0'
            }}
          >
            <Upload size={16} />
            <span style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2 }}>Upload</span>
          </div>

          {/* Delete Icon if custom or preset */}
          {!isAuto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(undefined)
              }}
              title="Remove image"
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.9)',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
              }}
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>

        {/* ─── Right Controls: Action Tabs ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tab Selector Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 10,
              background: '#e2e8f0',
              padding: 2,
              borderRadius: 8
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11.5,
                fontWeight: activeTab === 'upload' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'upload' ? '#ffffff' : 'transparent',
                color: activeTab === 'upload' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                boxShadow: activeTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Upload size={12} />
              <span>Upload Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11.5,
                fontWeight: activeTab === 'presets' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'presets' ? '#ffffff' : 'transparent',
                color: activeTab === 'presets' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                boxShadow: activeTab === 'presets' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={12} />
              <span>Bakery Presets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('url')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11.5,
                fontWeight: activeTab === 'url' ? 700 : 500,
                borderRadius: 6,
                border: 'none',
                background: activeTab === 'url' ? '#ffffff' : 'transparent',
                color: activeTab === 'url' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                boxShadow: activeTab === 'url' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <LinkIcon size={12} />
              <span>Web URL</span>
            </button>
          </div>

          {/* ─── Tab 1: Upload Photo ─── */}
          {activeTab === 'upload' && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '1.5px dashed #2563eb' : '1px dashed #cbd5e1',
                  background: isDragging ? '#eff6ff' : '#ffffff',
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                    Choose an image file from your device
                  </div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                    PNG, JPG, WEBP (Auto-resized & optimized)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                      color: '#ffffff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Upload size={13} />
                    <span>Browse...</span>
                  </button>

                  {typeof window !== 'undefined' && (window as any).electronAPI?.selectImageDialog && (
                    <button
                      type="button"
                      onClick={handleSelectFromDesktop}
                      disabled={isProcessing}
                      title="Select file using Desktop Dialog"
                      style={{
                        height: 32,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <FolderOpen size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
            </div>
          )}

          {/* ─── Tab 2: Bakery Presets ─── */}
          {activeTab === 'presets' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  paddingBottom: 4
                }}
              >
                {sortedPresets.map((preset) => {
                  const isSelected = value === preset.path
                  const isCategoryMatch =
                    categoryName &&
                    preset.categories.some((c) =>
                      categoryName.toLowerCase().includes(c.toLowerCase())
                    )

                  return (
                    <Tooltip
                      key={preset.id}
                      title={`${preset.name} (${preset.categories.join(', ')})`}
                    >
                      <div
                        onClick={() => onChange(preset.path)}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          flexShrink: 0,
                          border: isSelected
                            ? '2.5px solid #16a34a'
                            : isCategoryMatch
                              ? '1.5px solid #86efac'
                              : '1px solid #cbd5e1',
                          opacity: isSelected ? 1 : isCategoryMatch ? 0.95 : 0.65,
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                          boxShadow: isSelected
                            ? '0 2px 8px rgba(22, 163, 74, 0.35)'
                            : 'none',
                          position: 'relative',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <img
                          src={preset.path}
                          alt={preset.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 1,
                              right: 1,
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: '#16a34a',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Check size={9} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Tab 3: Web URL ─── */}
          {activeTab === 'url' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Input
                placeholder="https://example.com/cake.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPressEnter={handleApplyUrl}
                size="middle"
                style={{ borderRadius: 6, fontSize: 12 }}
                allowClear
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
