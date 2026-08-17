import React, { useState } from 'react'
import { Settings, Printer, Store, Users, KeyRound, Check } from 'lucide-react'
import { message } from 'antd'
import { useAppStore } from '../../store/appStore'

export const SettingsPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentTerminalId = useAppStore((state) => state.currentTerminalId)
  const setTerminalId = useAppStore((state) => state.setTerminalId)
  const [isTestingPrint, setIsTestingPrint] = useState(false)

  const handleTestPrint = async () => {
    setIsTestingPrint(true)
    try {
      if (window.electronAPI) {
        await window.electronAPI.testPrint()
        message.success('Test receipt command sent to thermal printer!')
      } else {
        message.info('Thermal test print simulated (Browser mode)')
      }
    } catch (err: any) {
      message.error(err.message || 'Printer test failed')
    } finally {
      setIsTestingPrint(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col p-6 overflow-y-auto space-y-6">
      {/* Header Bar */}
      <div className="pb-3 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={22} className="text-brand-400" />
          <span>System & Hardware Settings</span>
        </h2>
        <p className="text-xs text-slate-400">
          Configure branch identity, terminal ID, thermal printer, and hardware devices
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 🏪 Branch & Terminal Info Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Store size={18} className="text-brand-400" />
            <span>Active Branch Configuration</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Branch Name</label>
              <input
                disabled
                value={currentShop?.name || ''}
                className="w-full rounded-xl bg-slate-950 p-2.5 text-slate-300 border border-slate-800 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Branch Code</label>
                <input
                  disabled
                  value={currentShop?.branch_code || ''}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-brand-400 font-mono font-bold border border-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Terminal Code</label>
                <select
                  value={currentTerminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 p-2.5 text-cyan-400 font-mono font-bold border border-slate-700 focus:outline-none"
                >
                  <option value="T1">T1 (Counter 1)</option>
                  <option value="T2">T2 (Counter 2)</option>
                  <option value="T3">T3 (Counter 3)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Address & Phone</label>
              <p className="text-slate-300 font-medium">{currentShop?.address}</p>
              <p className="text-slate-400">{currentShop?.phone}</p>
            </div>
          </div>
        </div>

        {/* 🖨️ Thermal Printer Configuration Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Printer size={18} className="text-brand-400" />
            <span>Thermal Bill Printer (ESC/POS)</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Direct high-speed USB receipt printing with auto-cutter and drawer kick commands.
          </p>

          <div className="space-y-3 pt-2">
            <button
              disabled={isTestingPrint}
              onClick={handleTestPrint}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 w-full py-3 text-xs font-bold text-white shadow-lg glow-pink hover:bg-brand-600 active:scale-98 transition-all"
            >
              <Printer size={16} />
              <span>{isTestingPrint ? 'Sending Command...' : 'Execute Test Receipt Print'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
