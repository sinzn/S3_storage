// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const connectionForm = document.getElementById('connection-form');
    const dashboard = document.getElementById('dashboard');
    const connectButton = document.getElementById('connect-button');
    const disconnectButton = document.getElementById('disconnect-button');
    const submitConnectButton = document.getElementById('submit-connect');
    const accessKeyIdInput = document.getElementById('accessKeyId');
    const secretAccessKeyInput = document.getElementById('secretAccessKey');
    const regionInput = document.getElementById('region');
    const bucketNameInput = document.getElementById('bucketName');
    const bucketStatusSpan = document.getElementById('bucket-status');
    const connectedBucketNameSpan = document.getElementById('connected-bucket-name');
    const errorMessageDiv = document.getElementById('error-message');
    const dashboardErrorMessageDiv = document.getElementById('dashboard-error-message');

    const currentPathSpan = document.getElementById('current-path');
    const goBackButton = document.getElementById('go-back-button'); // Corrected ID to match HTML
    const newFolderButton = document.getElementById('new-folder-button');
    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-select');
    const fileUploadInput = document.getElementById('file-upload');
    const dropArea = document.getElementById('drop-area'); // New: for drag and drop
    const fileListContainer = document.getElementById('file-list-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const noFilesMessage = document.getElementById('no-files-message');
    const fileTable = document.getElementById('file-table');
    const fileTableBody = document.getElementById('file-table-body');

    const selectAllCheckbox = document.getElementById('select-all-checkbox'); // New: Select All checkbox
    const bulkActionsDiv = document.getElementById('bulk-actions'); // New: Bulk actions container
    const deleteSelectedButton = document.getElementById('delete-selected-button'); // New: Delete Selected button
    const shareSelectedButton = document.getElementById('share-selected-button'); // New: Share Selected button

    // Upload Progress Bar Elements
    const uploadProgressContainer = document.getElementById('upload-progress-container');
    const uploadFileNameSpan = document.getElementById('upload-file-name');
    const uploadPercentageSpan = document.getElementById('upload-percentage');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const uploadSpeedSpan = document.getElementById('upload-speed');
    const uploadETASpan = document.getElementById('upload-eta');

    // Custom Modal Elements
    const customModal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalOkButton = document.getElementById('modal-ok-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');

    // Custom Input Modal Elements (for new folder)
    const inputModal = document.getElementById('input-modal');
    const inputModalTitle = document.getElementById('input-modal-title');
    const inputModalField = document.getElementById('input-modal-field');
    const inputModalError = document.getElementById('input-modal-error');
    const inputModalOkButton = document.getElementById('input-modal-ok-button');
    const inputModalCancelButton = document.getElementById('input-modal-cancel-button');

    // Share Modal Elements
    const shareModal = document.getElementById('share-modal');
    const shareExpiryRadios = document.querySelectorAll('input[name="share-expiry"]');
    const customExpiryMinutesInput = document.getElementById('custom-expiry-minutes');
    const shareLinkResultDiv = document.getElementById('share-link-result');
    const shareModalErrorDiv = document.getElementById('share-modal-error');
    const shareModalCloseButton = document.getElementById('share-modal-close-button');
    const generateShareLinkButton = document.getElementById('generate-share-link-button');
    const copyShareLinkButton = document.getElementById('copy-share-link-button');

    // State variables
    let currentFiles = [];
    let currentSearchQuery = '';
    let currentFilterType = 'all';
    let currentPath = ''; // New: Tracks the current S3 prefix/folder path
    let selectedFiles = new Set(); // New: Stores keys of selected files/folders

    // --- Custom Modal Functions ---
    /**
     * Shows a custom alert modal.
     * @param {string} title - The title of the alert.
     * @param {string} message - The message to display.
     */
    const showAlert = (title, message) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalCancelButton.classList.add('hidden'); // Hide cancel button for alerts
        modalOkButton.textContent = 'OK';
        customModal.classList.remove('hidden');
        return new Promise(resolve => {
            modalOkButton.onclick = () => {
                customModal.classList.add('hidden');
                resolve(true);
            };
        });
    };

    /**
     * Shows a custom confirmation modal.
     * @param {string} title - The title of the confirmation.
     * @param {string} message - The message to display.
     * @returns {Promise<boolean>} - Resolves true if OK is clicked, false if Cancel is clicked.
     */
    const showConfirm = (title, message) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalCancelButton.classList.remove('hidden'); // Show cancel button for confirmations
        modalOkButton.textContent = 'Confirm';
        customModal.classList.remove('hidden');
        return new Promise(resolve => {
            modalOkButton.onclick = () => {
                customModal.classList.add('hidden');
                resolve(true);
            };
            modalCancelButton.onclick = () => {
                customModal.classList.add('hidden');
                resolve(false);
            };
        });
    };

    /**
     * Shows a custom input modal.
     * @param {string} title - The title of the input modal.
     * @param {string} placeholder - Placeholder text for the input field.
     * @param {string} initialValue - Initial value for the input field.
     * @returns {Promise<string|null>} - Resolves with the input value if OK is clicked, null if Cancel.
     */
    const showInputModal = (title, placeholder = '', initialValue = '') => {
        inputModalTitle.textContent = title;
        inputModalField.value = initialValue;
        inputModalField.placeholder = placeholder;
        inputModalError.classList.add('hidden'); // Hide previous errors
        inputModal.classList.remove('hidden');

        return new Promise(resolve => {
            inputModalOkButton.onclick = () => {
                const value = inputModalField.value.trim();
                if (value === '') {
                    inputModalError.textContent = 'Input cannot be empty.';
                    inputModalError.classList.remove('hidden');
                    return;
                }
                inputModal.classList.add('hidden');
                resolve(value);
            };
            inputModalCancelButton.onclick = () => {
                inputModal.classList.add('hidden');
                resolve(null);
            };
        });
    };

    // --- Utility Functions ---

    /**
     * Helper function to determine file type based on extension.
     * @param {string} key - The file key (path) from S3.
     * @returns {string} - The determined file type (e.g., 'Image', 'Video', 'Document', 'File').
     */
    const getFileType = (key) => {
        const extension = key.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
            return 'Image';
        }
        if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
            return 'Video';
        }
        if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
            return 'Document';
        }
        return 'File';
    };

    /**
     * Helper function to format bytes for display.
     * @param {number} bytes - The size in bytes.
     * @param {number} decimals - Number of decimal places.
     * @returns {string} - Formatted size string (e.g., '1.23 MB').
     */
    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    /**
     * Formats seconds into a human-readable time string.
     * @param {number} seconds - Time in seconds.
     * @returns {string} - Formatted time (e.g., "1m 30s", "1h 5m").
     */
    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return 'N/A';
        if (seconds === Infinity) return 'Infinity';

        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        let parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (s > 0 || parts.length === 0) parts.push(`${s}s`); // Ensure at least seconds are shown

        return parts.join(' ');
    };

    /**
     * Displays an error message in the specified div.
     * @param {HTMLElement} element - The HTML element to display the error.
     * @param {string} message - The error message.
     */
    const displayError = (element, message) => {
        element.textContent = `Error: ${message}`;
        element.classList.remove('hidden');
    };

    /**
     * Hides the error message in the specified div.
     * @param {HTMLElement} element - The HTML element to hide the error.
     */
    const hideError = (element) => {
        element.classList.add('hidden');
        element.textContent = '';
    };

    /**
     * Copies text to the clipboard.
     * @param {string} text - The text to copy.
     */
    const copyToClipboard = (text) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showAlert('Copied!', 'Link copied to clipboard.');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showAlert('Error', 'Failed to copy link. Please copy manually.');
        }
        document.body.removeChild(textarea);
    };

    // --- UI State Management ---

    /**
     * Updates the UI based on connection status.
     * @param {boolean} connected - True if connected, false otherwise.
     * @param {string} bucket - The connected bucket name.
     */
    const updateUI = (connected, bucket = '') => {
        if (connected) {
            connectionForm.classList.add('hidden');
            dashboard.classList.remove('hidden');
            connectButton.classList.add('hidden');
            disconnectButton.classList.remove('hidden');
            bucketStatusSpan.classList.remove('hidden');
            bucketStatusSpan.style.display = 'flex'; // Ensure flex for icon alignment
            connectedBucketNameSpan.textContent = bucket;
        } else {
            connectionForm.classList.remove('hidden');
            dashboard.classList.add('hidden');
            connectButton.classList.remove('hidden');
            disconnectButton.classList.add('hidden');
            bucketStatusSpan.classList.add('hidden');
            connectedBucketNameSpan.textContent = '';
            // Clear credentials from inputs on disconnect for security
            accessKeyIdInput.value = '';
            secretAccessKeyInput.value = '';
            bucketNameInput.value = '';
        }
    };

    /**
     * Updates the visibility of bulk action buttons.
     */
    const updateBulkActionsVisibility = () => {
        if (selectedFiles.size > 0) {
            bulkActionsDiv.classList.remove('hidden');
            // Share selected button is only enabled if exactly one file is selected
            if (selectedFiles.size === 1 && !currentFiles.find(f => f.Key === Array.from(selectedFiles)[0])?.Type.includes('Folder')) {
                shareSelectedButton.classList.remove('opacity-50', 'cursor-not-allowed');
                shareSelectedButton.disabled = false;
            } else {
                shareSelectedButton.classList.add('opacity-50', 'cursor-not-allowed');
                shareSelectedButton.disabled = true;
            }
        } else {
            bulkActionsDiv.classList.add('hidden');
        }
    };

    /**
     * Renders the file list in the table.
     * @param {Array<Object>} filesToRender - The array of file objects to display.
     */
    const renderFiles = (filesToRender) => {
        fileTableBody.innerHTML = ''; // Clear existing rows
        hideError(dashboardErrorMessageDiv);
        loadingIndicator.classList.add('hidden');

        // Reset selected files and select all checkbox
        selectedFiles.clear();
        selectAllCheckbox.checked = false;
        updateBulkActionsVisibility();

        // Update current path display
        currentPathSpan.textContent = currentPath === '' ? '/' : `/${currentPath}`;
        // Show/hide "Back" button based on currentPath
        if (currentPath === '') {
            goBackButton.classList.add('hidden'); // Changed from goUpButton to goBackButton
        } else {
            goBackButton.classList.remove('hidden'); // Changed from goUpButton to goBackButton
        }


        if (filesToRender.length === 0) {
            fileTable.classList.add('hidden');
            noFilesMessage.classList.remove('hidden');
        } else {
            fileTable.classList.remove('hidden');
            noFilesMessage.classList.add('hidden');
            filesToRender.forEach(file => {
                const row = fileTableBody.insertRow();
                row.classList.add('hover:bg-gray-700', 'transition', 'duration-150');

                // Checkbox cell
                const checkboxCell = row.insertCell();
                checkboxCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-teal-600', 'bg-gray-700', 'border-gray-600', 'rounded', 'focus:ring-teal-500');
                checkbox.checked = selectedFiles.has(file.Key);
                checkbox.addEventListener('change', () => handleItemSelection(file.Key, checkbox.checked));
                checkboxCell.appendChild(checkbox);

                const nameCell = row.insertCell();
                nameCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'font-medium', 'text-white', 'monospace-font'); // Added monospace-font
                if (file.Type === 'Folder') {
                    const folderLink = document.createElement('a');
                    folderLink.href = '#';
                    folderLink.classList.add('flex', 'items-center', 'hover:text-teal-400');
                    folderLink.innerHTML = `
                        <svg class="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                        </svg>
                        ${file.Key.replace(currentPath, '').replace(/^\//, '').replace(/\/$/, '')}
                    `;
                    folderLink.onclick = (e) => {
                        e.preventDefault();
                        handleFolderClick(file.Key);
                    };
                    nameCell.appendChild(folderLink);
                } else {
                    nameCell.innerHTML = `
                        <span class="flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0117 8.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4.5 1.5a1.5 1.5 0 00-3 0v3a1.5 1.5 0 003 0v-3z" clip-rule="evenodd"></path>
                            </svg>
                            ${file.Key.split('/').pop()}
                        </span>
                    `;
                }

                const typeCell = row.insertCell();
                typeCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-400');
                typeCell.textContent = file.Type;

                const sizeCell = row.insertCell();
                sizeCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-400');
                sizeCell.textContent = file.Size;

                const modifiedCell = row.insertCell();
                modifiedCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-400');
                modifiedCell.textContent = file.LastModified;

                const actionsCell = row.insertCell();
                actionsCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-right', 'text-sm', 'font-medium');

                if (file.Type !== 'Folder') {
                    // Download Button
                    const downloadButton = document.createElement('button');
                    downloadButton.classList.add('text-teal-500', 'hover:text-teal-700', 'mr-3');
                    downloadButton.title = 'Download';
                    downloadButton.innerHTML = `
                        <svg class="w-5 h-5 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    `;
                    downloadButton.onclick = () => handleFileDownload(file.Key);
                    actionsCell.appendChild(downloadButton);

                    // Share Button
                    const shareButton = document.createElement('button');
                    shareButton.classList.add('text-blue-500', 'hover:text-blue-700', 'mr-3');
                    shareButton.title = 'Share';
                    shareButton.innerHTML = `
                        <svg class="w-5 h-5 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M18 8a6 6 0 00-6-6H4a2 2 0 00-2 2v10a2 2 0 002 2h8a6 6 0 006-6V8zm-6-4a2 2 0 100 4 2 2 0 000-4zm-8 8a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" clip-rule="evenodd"></path>
                        </svg>
                    `;
                    shareButton.onclick = () => handleFileShare(file.Key);
                    actionsCell.appendChild(shareButton);
                }

                // Delete Button
                const deleteButton = document.createElement('button');
                deleteButton.classList.add('text-red-500', 'hover:text-red-700');
                deleteButton.title = 'Delete';
                deleteButton.innerHTML = `
                    <svg class="w-5 h-5 inline-block" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm-1 3a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                    </svg>
                `;
                deleteButton.onclick = () => handleFileDelete(file.Key);
                actionsCell.appendChild(deleteButton);
            });
        }
    };

    /**
     * Handles item selection via checkboxes.
     * @param {string} key - The key of the item.
     * @param {boolean} isChecked - Whether the item is checked.
     */
    const handleItemSelection = (key, isChecked) => {
        if (isChecked) {
            selectedFiles.add(key);
        } else {
            selectedFiles.delete(key);
        }
        updateBulkActionsVisibility();
        // If "select all" was checked and now an item is unchecked, uncheck "select all"
        if (!isChecked && selectAllCheckbox.checked) {
            selectAllCheckbox.checked = false;
        }
        // If all items are now selected, check "select all"
        if (selectedFiles.size === currentFiles.length && currentFiles.length > 0) {
            selectAllCheckbox.checked = true;
        }
    };

    /**
     * Handles select all checkbox.
     * @param {boolean} isChecked - Whether select all is checked.
     */
    const handleSelectAll = (isChecked) => {
        selectedFiles.clear();
        if (isChecked) {
            currentFiles.forEach(file => selectedFiles.add(file.Key));
        }
        // Re-render to update all checkboxes
        applySearchAndFilter();
        updateBulkActionsVisibility();
    };

    /**
     * Applies search and filter to the current file list and re-renders.
     */
    const applySearchAndFilter = () => {
        const filtered = currentFiles.filter(file => {
            const displayName = file.Type === 'Folder' ? file.Key.replace(currentPath, '').replace(/^\//, '').replace(/\/$/, '') : file.Key.split('/').pop();
            const matchesSearch = displayName.toLowerCase().includes(currentSearchQuery.toLowerCase());
            const matchesFilter = currentFilterType === 'all' || file.Type.toLowerCase() === currentFilterType;
            return matchesSearch && matchesFilter;
        });
        renderFiles(filtered);
    };

    // --- API Interactions ---

    /**
     * Connects to the S3 backend.
     */
    const handleConnect = async () => {
        hideError(errorMessageDiv);
        const accessKeyId = accessKeyIdInput.value.trim();
        const secretAccessKey = secretAccessKeyInput.value.trim();
        const region = regionInput.value.trim();
        const bucketName = bucketNameInput.value.trim();

        if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
            displayError(errorMessageDiv, 'All fields are required.');
            return;
        }

        try {
            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessKeyId, secretAccessKey, region, bucketName })
            });
            const data = await response.json();
            if (data.success) {
                updateUI(true, bucketName);
                currentPath = ''; // Reset path on new connection
                fetchFiles(currentPath);
                localStorage.setItem('s3_accessKeyId', accessKeyId);
                localStorage.setItem('s3_secretAccessKey', secretAccessKey);
                localStorage.setItem('s3_region', region);
                localStorage.setItem('s3_bucketName', bucketName);
            } else {
                displayError(errorMessageDiv, data.message);
            }
        } catch (err) {
            console.error('Connection error:', err);
            displayError(errorMessageDiv, 'Network error or server unavailable.');
        }
    };

    /**
     * Disconnects from the S3 backend.
     */
    const handleDisconnect = async () => {
        try {
            const response = await fetch('/api/disconnect', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                updateUI(false);
                currentFiles = []; // Clear files on disconnect
                currentSearchQuery = '';
                currentFilterType = 'all';
                currentPath = ''; // Reset path
                selectedFiles.clear(); // Clear selections
                searchInput.value = '';
                filterSelect.value = 'all';
                renderFiles([]); // Clear UI
                localStorage.removeItem('s3_accessKeyId');
                localStorage.removeItem('s3_secretAccessKey');
                localStorage.removeItem('s3_region');
                localStorage.removeItem('s3_bucketName');
            } else {
                showAlert('Error', data.message);
            }
        } catch (err) {
            console.error('Disconnect error:', err);
            showAlert('Error', 'Network error during disconnect.');
        }
    };

    /**
     * Fetches files from the S3 backend for the given path.
     * @param {string} path - The S3 prefix/path to list objects from.
     */
    const fetchFiles = async (path = '') => {
        loadingIndicator.classList.remove('hidden');
        fileTable.classList.add('hidden');
        noFilesMessage.classList.add('hidden');
        hideError(dashboardErrorMessageDiv);

        try {
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const data = await response.json();
            if (data.success) {
                currentFiles = data.files.map(file => ({
                    ...file,
                    Size: file.Size !== '-' ? formatBytes(file.Size) : '-',
                    LastModified: file.LastModified !== '-' ? new Date(file.LastModified).toLocaleDateString() : '-',
                }));
                currentPath = path; // Update current path
                applySearchAndFilter(); // Apply current search/filter
            } else {
                displayError(dashboardErrorMessageDiv, data.message);
                currentFiles = [];
                renderFiles([]);
            }
        } catch (err) {
            console.error('Fetch files error:', err);
            displayError(dashboardErrorMessageDiv, 'Network error or server unavailable.');
            currentFiles = [];
            renderFiles([]);
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };

    /**
     * Handles file upload with progress tracking.
     * @param {Event} event - The file input change event or drag-drop event.
     */
    const handleFileUpload = async (event) => {
        const filesToUpload = event.dataTransfer ? event.dataTransfer.files : event.target.files;
        if (filesToUpload.length === 0) return;

        hideError(dashboardErrorMessageDiv);

        for (const file of filesToUpload) {
            uploadProgressContainer.classList.remove('hidden');
            uploadFileNameSpan.textContent = file.name;
            uploadProgressBar.style.width = '0%';
            uploadPercentageSpan.textContent = '0%';
            uploadSpeedSpan.textContent = 'Speed: 0 KB/s';
            uploadETASpan.textContent = 'ETA: Calculating...';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', currentPath); // Send current path for upload

            const xhr = new XMLHttpRequest(); // Corrected: Removed 'new' before XMLHttpRequest
            xhr.open('POST', '/api/upload', true);

            let startTime = Date.now();
            let lastLoaded = 0; // Bytes loaded in the previous progress event
            let lastTime = startTime; // Time of the previous progress event

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    uploadProgressBar.style.width = `${percent}%`;
                    uploadPercentageSpan.textContent = `${percent.toFixed(0)}%`;

                    const currentTime = Date.now();
                    const timeElapsed = (currentTime - lastTime) / 1000; // in seconds
                    const bytesSinceLast = e.loaded - lastLoaded; // Bytes uploaded since last event

                    if (timeElapsed > 0) {
                        const currentSpeedBps = bytesSinceLast / timeElapsed; // Bytes per second
                        const currentSpeedKbps = currentSpeedBps / 1024; // KB per second
                        uploadSpeedSpan.textContent = `Speed: ${currentSpeedKbps.toFixed(2)} KB/s`;

                        const remainingBytes = e.total - e.loaded;
                        const etaSeconds = remainingBytes / currentSpeedBps;
                        uploadETASpan.textContent = `ETA: ${formatTime(etaSeconds)}`;
                    }

                    lastLoaded = e.loaded;
                    lastTime = currentTime;
                }
            };

            xhr.onload = async () => {
                uploadProgressContainer.classList.add('hidden');
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        showAlert('Success', `File "${file.name}" uploaded successfully!`);
                        fetchFiles(currentPath); // Refresh file list
                    } else {
                        displayError(dashboardErrorMessageDiv, `Failed to upload ${file.name}: ${data.message}`);
                    }
                } else {
                    const errorData = JSON.parse(xhr.responseText);
                    displayError(dashboardErrorMessageDiv, `Failed to upload ${file.name}: ${errorData.message || 'Server error'}`);
                }
            };

            xhr.onerror = () => {
                uploadProgressContainer.classList.add('hidden');
                displayError(dashboardErrorMessageDiv, `Network error during upload of ${file.name}.`);
            };

            xhr.send(formData);
        }

        event.target.value = null; // Clear the input field
    };

    /**
     * Handles file download.
     * @param {string} key - The key of the file to download.
     */
    const handleFileDownload = async (key) => {
        loadingIndicator.classList.remove('hidden');
        hideError(dashboardErrorMessageDiv);

        try {
            // Directly fetch the file from the server's download endpoint
            const response = await fetch(`/api/download/${encodeURIComponent(key)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to download file.');
            }

            // Get blob and create a temporary URL for download
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = key.split('/').pop(); // Get filename from key
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); // Clean up the URL object
            showAlert('Success', 'File download initiated.');
        } catch (err) {
            console.error('Download error:', err);
            displayError(dashboardErrorMessageDiv, err.message || 'Failed to download file.');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };


    /**
     * Handles file deletion.
     * @param {string} key - The key of the file to delete.
     */
    const handleFileDelete = async (key) => {
        const confirmed = await showConfirm('Confirm Deletion', `Are you sure you want to delete "${key}"?`);
        if (!confirmed) {
            return;
        }

        loadingIndicator.classList.remove('hidden');
        hideError(dashboardErrorMessageDiv);

        try {
            const response = await fetch('/api/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });
            const data = await response.json();
            if (data.success) {
                showAlert('Success', 'File deleted successfully!');
                fetchFiles(currentPath); // Refresh file list
            } else {
                displayError(dashboardErrorMessageDiv, data.message);
            }
        } catch (err) {
            console.error('Delete error:', err);
            displayError(dashboardErrorMessageDiv, 'Network error during deletion.');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };

    /**
     * Handles creating a new folder.
     */
    const handleNewFolder = async () => {
        const folderName = await showInputModal('New Folder', 'Enter new folder name');
        if (folderName === null) {
            return; // User cancelled
        }

        loadingIndicator.classList.remove('hidden');
        hideError(dashboardErrorMessageDiv);

        try {
            const response = await fetch('/api/create-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName: `${currentPath}${folderName.trim()}/` }), // Ensure path is included
            });
            const data = await response.json();
            if (data.success) {
                showAlert('Success', `Folder "${folderName.trim()}" created successfully!`);
                fetchFiles(currentPath); // Refresh file list
            } else {
                displayError(dashboardErrorMessageDiv, data.message);
            }
        } catch (err) {
            console.error('Create folder error:', err);
            displayError(dashboardErrorMessageDiv, 'Network error during folder creation.');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };

    /**
     * Navigates into a selected folder.
     * @param {string} folderKey - The full S3 key of the folder (e.g., 'myfolder/').
     */
    const handleFolderClick = (folderKey) => {
        // Ensure folderKey ends with a slash for S3 prefixing
        const newPath = folderKey.endsWith('/') ? folderKey : `${folderKey}/`;
        fetchFiles(newPath);
    };

    /**
     * Navigates up one level in the folder hierarchy.
     */
    const handleGoBack = () => { // Renamed function to match button ID
        if (currentPath === '') return; // Already at root

        const pathSegments = currentPath.split('/').filter(Boolean); // Remove empty strings
        pathSegments.pop(); // Remove the last segment
        const newPath = pathSegments.length > 0 ? `${pathSegments.join('/')}/` : '';
        fetchFiles(newPath);
    };

    /**
     * Handles showing the share modal and generating the link.
     * @param {string} fileKey - The key of the file to share.
     */
    let fileKeyToShare = null; // Store the key of the file currently being shared
    const handleFileShare = (fileKey) => {
        fileKeyToShare = fileKey;
        shareModal.classList.remove('hidden');
        shareLinkResultDiv.classList.add('hidden');
        shareLinkResultDiv.textContent = '';
        shareModalErrorDiv.classList.add('hidden');
        copyShareLinkButton.classList.add('hidden');
        generateShareLinkButton.classList.remove('hidden');
        customExpiryMinutesInput.classList.add('hidden'); // Hide custom input by default
        shareExpiryRadios[0].checked = true; // Default to 1 Day
    };

    const generateShareLink = async () => {
        if (!fileKeyToShare) return;

        shareModalErrorDiv.classList.add('hidden');
        shareLinkResultDiv.classList.add('hidden');
        shareLinkResultDiv.textContent = '';
        copyShareLinkButton.classList.add('hidden');

        let expiresInSeconds;
        const selectedExpiry = document.querySelector('input[name="share-expiry"]:checked').value;

        switch (selectedExpiry) {
            case '1d': expiresInSeconds = 24 * 60 * 60; break;
            case '1w': expiresInSeconds = 7 * 24 * 60 * 60; break;
            case '1m': expiresInSeconds = 30 * 24 * 60 * 60; break; // Approximately 1 month
            case 'custom':
                const customMinutes = parseInt(customExpiryMinutesInput.value, 10);
                if (isNaN(customMinutes) || customMinutes <= 0) {
                    displayError(shareModalErrorDiv, 'Please enter a valid positive number for custom minutes.');
                    return;
                }
                expiresInSeconds = customMinutes * 60;
                break;
            default: expiresInSeconds = 24 * 60 * 60; // Default to 1 day
        }

        try {
            const response = await fetch('/api/generate-presigned-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: fileKeyToShare, expiresInSeconds }),
            });
            const data = await response.json();
            if (data.success) {
                shareLinkResultDiv.textContent = data.url;
                shareLinkResultDiv.classList.remove('hidden');
                copyShareLinkButton.classList.remove('hidden');
                generateShareLinkButton.classList.add('hidden'); // Hide generate button after link is made
            } else {
                displayError(shareModalErrorDiv, data.message);
            }
        } catch (err) {
            console.error('Generate share link error:', err);
            displayError(shareModalErrorDiv, 'Network error or server unavailable.');
        }
    };

    // --- Bulk Operations ---
    const handleDeleteSelected = async () => {
        if (selectedFiles.size === 0) {
            showAlert('No Items Selected', 'Please select items to delete.');
            return;
        }

        const confirmed = await showConfirm('Confirm Bulk Deletion', `Are you sure you want to delete ${selectedFiles.size} selected items? This action cannot be undone.`);
        if (!confirmed) {
            return;
        }

        loadingIndicator.classList.remove('hidden');
        hideError(dashboardErrorMessageDiv);

        const keysToDelete = Array.from(selectedFiles);
        let successCount = 0;
        let failCount = 0;

        for (const key of keysToDelete) {
            try {
                const response = await fetch('/api/delete', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key }),
                });
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    console.error(`Failed to delete ${key}: ${data.message}`);
                    failCount++;
                }
            } catch (err) {
                console.error(`Network error deleting ${key}:`, err);
                failCount++;
            }
        }

        loadingIndicator.classList.add('hidden');
        if (failCount === 0) {
            showAlert('Success', `${successCount} items deleted successfully!`);
        } else {
            showAlert('Partial Success', `${successCount} items deleted, ${failCount} failed.`);
        }
        fetchFiles(currentPath); // Refresh file list after bulk operation
    };

    const handleShareSelected = () => {
        if (selectedFiles.size === 0) {
            showAlert('No Items Selected', 'Please select an item to share.');
            return;
        }
        if (selectedFiles.size > 1) {
            showAlert('Multiple Selection', 'Bulk sharing is not directly supported. Please select only one file to generate a shareable link.');
            return;
        }
        const selectedKey = Array.from(selectedFiles)[0];
        const selectedFile = currentFiles.find(f => f.Key === selectedKey);

        if (selectedFile && selectedFile.Type === 'Folder') {
             showAlert('Cannot Share Folder', 'Folders cannot be shared directly. Only files can be shared.');
             return;
        }

        handleFileShare(selectedKey);
    };

    // --- Event Listeners ---
    submitConnectButton.addEventListener('click', handleConnect);
    connectButton.addEventListener('click', handleConnect);
    disconnectButton.addEventListener('click', handleDisconnect);
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        applySearchAndFilter();
    });
    filterSelect.addEventListener('change', (e) => {
        currentFilterType = e.target.value;
        applySearchAndFilter();
    });
    fileUploadInput.addEventListener('change', handleFileUpload);
    newFolderButton.addEventListener('click', handleNewFolder);
    goBackButton.addEventListener('click', handleGoBack); // Corrected: Used goBackButton and handleGoBack

    // Drag and Drop listeners
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('border-teal-500', 'bg-gray-700');
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.classList.remove('border-teal-500', 'bg-gray-700');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('border-teal-500', 'bg-gray-700');
        handleFileUpload(e); // Reuse handleFileUpload for dropped files
    });

    // Select All checkbox listener
    selectAllCheckbox.addEventListener('change', (e) => handleSelectAll(e.target.checked));

    // Bulk action buttons
    deleteSelectedButton.addEventListener('click', handleDeleteSelected);
    shareSelectedButton.addEventListener('click', handleShareSelected);

    // Share Modal Listeners
    shareModalCloseButton.addEventListener('click', () => shareModal.classList.add('hidden'));
    generateShareLinkButton.addEventListener('click', generateShareLink);
    copyShareLinkButton.addEventListener('click', () => copyToClipboard(shareLinkResultDiv.textContent));
    shareExpiryRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customExpiryMinutesInput.classList.remove('hidden');
            } else {
                customExpiryMinutesInput.classList.add('hidden');
            }
            shareLinkResultDiv.classList.add('hidden'); // Hide previous link
            shareModalErrorDiv.classList.add('hidden'); // Hide errors
            copyShareLinkButton.classList.add('hidden'); // Hide copy button
            generateShareLinkButton.classList.remove('hidden'); // Show generate button again
        });
    });


    // --- Initial Load ---
    // Attempt to load credentials from localStorage and connect
    const storedAccessKeyId = localStorage.getItem('s3_accessKeyId');
    const storedSecretAccessKey = localStorage.getItem('s3_secretAccessKey');
    const storedRegion = localStorage.getItem('s3_region');
    const storedBucketName = localStorage.getItem('s3_bucketName');

    if (storedAccessKeyId && storedSecretAccessKey && storedRegion && storedBucketName) {
        accessKeyIdInput.value = storedAccessKeyId;
        secretAccessKeyInput.value = storedSecretAccessKey;
        regionInput.value = storedRegion;
        bucketNameInput.value = storedBucketName;
        handleConnect(); // Attempt to connect automatically
    } else {
        updateUI(false); // Show connection form if no stored credentials
    }
});
