import { apiClient } from './apiClient'

export interface BackupResultDto {
  success: boolean
  filePath?: string
  fileSizeBytes?: number
  timestamp?: string
  error?: string
}

export const backupApi = {
  runBackup: (): Promise<BackupResultDto> => apiClient.post<BackupResultDto>('/backup/run'),
  listBackups: (): Promise<string[]> => apiClient.get<string[]>('/backup/list')
}

export default backupApi
