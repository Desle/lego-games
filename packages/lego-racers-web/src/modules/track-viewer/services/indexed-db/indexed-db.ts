export const getRequestResult = <Value>(request: IDBRequest<Value>): Promise<Value> =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed'))
    )
  })

// Opens (and on first use creates) a database with one object store.
export const openDatabase = (
  databaseName: string,
  storeName: string,
  version: number
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, version)
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore(storeName))
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB could not be opened'))
    )
    request.addEventListener('blocked', () => reject(new Error('IndexedDB is blocked')))
  })
