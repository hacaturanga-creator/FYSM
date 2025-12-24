// ============================================
// FITBOOK - ПОЛНОЕ ПРИЛОЖЕНИЕ
// ============================================

// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD5gplXXpP69H0f0WDQehy4jLOOTnw2rZQ",
    authDomain: "fysm-2d26a.firebaseapp.com",
    projectId: "fysm-2d26a",
    storageBucket: "fysm-2d26a.firebasestorage.app",
    messagingSenderId: "1013209595020",
    appId: "1:1013209595020:web:5057a63c94dbf29aa4cfa9"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Глобальные переменные
let currentUser = null;
let userData = null;
let selectedTrainingId = null;
let selectedTrainingPrice = 0;
let notificationsListener = null;
let trainingsLastDoc = null;
let trainingsHasMore = true;
const TRAININGS_PER_PAGE = 10;

// ============================================
// 🔐 ОСНОВНЫЕ ФУНКЦИИ АВТОРИЗАЦИИ
// ============================================

// Показать/скрыть экраны
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenName + 'Screen');
    if (targetScreen) targetScreen.classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === screenName) btn.classList.add('active');
    });
    
    switch(screenName) {
        case 'schedule': 
            loadTrainings(); 
            break;
        case 'balance': 
            loadTransactions(); 
            break;
        case 'myBookings': 
            loadMyBookings(); 
            break;
        case 'ratings': 
            loadMyRatings(); 
            break;
        case 'trainer': 
            loadTrainerStats(); 
            setTimeout(() => {
                if (typeof loadAttendanceCharts === 'function') {
                    loadAttendanceCharts();
                }
            }, 500);
            break;
        case 'admin':
            if (typeof loadAdminStats === 'function') {
                loadAdminStats();
                loadAdminUsers();
            }
            break;
    }
}

// Модальные окна
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Регистрация
async function register() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) return alert('Введите email и пароль');
    if (password.length < 6) return alert('Пароль минимум 6 символов');
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('users').doc(user.uid).set({
            name: email.split('@')[0],
            email: email,
            role: 'user',
            balance: 100,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Регистрация успешна! 100 баллов начислено.');
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// Вход
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) return alert('Введите email и пароль');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// Выход
async function logout() {
    if (confirm('Выйти?')) await auth.signOut();
}

// Загрузка данных пользователя
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            updateUI();
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// Обновление интерфейса
function updateUI() {
    if (!userData) return;
    
    document.getElementById('userName').textContent = userData.name || userData.email;
    document.getElementById('balanceAmount').textContent = userData.balance || 0;
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.querySelector('.bottom-nav').style.display = 'flex';
    
    const trainerNavBtn = document.getElementById('trainerNavBtn');
    if (userData.role === 'trainer') {
        trainerNavBtn.style.display = 'flex';
    } else {
        trainerNavBtn.style.display = 'none';
    }
}

// ============================================
// 📄 ПАГИНАЦИЯ И ФИЛЬТРАЦИЯ ТРЕНИРОВОК
// ============================================

// Фильтры
let currentFilters = {
    search: '',
    date: '',
    price: '',
    trainer: '',
    status: ''
};

// Загрузка тренировок с фильтрами
async function loadTrainings(loadMore = false) {
    try {
        const container = document.getElementById('trainingsList');
        
        if (!loadMore) {
            container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';
            trainingsLastDoc = null;
            trainingsHasMore = true;
        }
        
        let query = db.collection('trainings');
        
        // Базовые фильтры
        query = query.where('date', '>=', firebase.firestore.Timestamp.now());
        query = query.orderBy('date');
        
        // Пагинация
        if (trainingsLastDoc && loadMore) {
            query = query.startAfter(trainingsLastDoc);
        }
        
        query = query.limit(TRAININGS_PER_PAGE);
        
        const querySnapshot = await query.get();
        
        if (querySnapshot.empty) {
            if (!loadMore) {
                container.innerHTML = '<p class="text-center">Нет тренировок</p>';
            }
            trainingsHasMore = false;
            return;
        }
        
        trainingsLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        trainingsHasMore = querySnapshot.docs.length === TRAININGS_PER_PAGE;
        
        // Очищаем контейнер если первая загрузка
        if (!loadMore) {
            container.innerHTML = '';
        }
        
        // Отображаем тренировки
        querySnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date.toDate();
            const isCancelled = training.cancelled;
            
            const card = document.createElement('div');
            card.className = 'training-card';
            card.style.borderLeft = isCancelled ? '4px solid #dc3545' : '4px solid #667eea';
            card.style.opacity = isCancelled ? '0.7' : '1';
            
            card.innerHTML = `
                ${isCancelled ? '<div style="background: #dc3545; color: white; padding: 5px; border-radius: 5px; margin-bottom: 10px; text-align: center;">❌ ОТМЕНЕНА</div>' : ''}
                <h3>${training.title || 'Без названия'}</h3>
                <div class="training-meta">
                    <span><i class="far fa-calendar"></i> ${date.toLocaleDateString()}</span>
                    <span><i class="far fa-clock"></i> ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span><i class="fas fa-coins"></i> ${training.price || 0} баллов</span>
                    ${training.maxParticipants ? `<span><i class="fas fa-users"></i> до ${training.maxParticipants} чел.</span>` : ''}
                </div>
                ${training.description ? `<p>${training.description}</p>` : ''}
                ${training.trainerName ? `<p><small><i class="fas fa-user-tie"></i> ${training.trainerName}</small></p>` : ''}
                
                <div class="mt-2">
                    ${userData && userData.role === 'trainer' ? `
                        <div style="display: flex; gap: 10px;">
                            <button onclick="editTraining('${doc.id}')" class="btn-secondary" style="flex: 1;">
                                <i class="fas fa-edit"></i> Редактировать
                            </button>
                            ${!isCancelled ? `
                                <button onclick="cancelTraining('${doc.id}')" class="btn-danger" style="flex: 1; background: #dc3545;">
                                    <i class="fas fa-ban"></i> Отменить
                                </button>
                            ` : ''}
                        </div>
                    ` : `
                        <div style="display: flex; gap: 10px;">
                            <button onclick="openRegisterModal('${doc.id}', ${training.price || 0}, '${training.title}')" 
                                    class="btn-primary" style="flex: 1;"
                                    ${(userData && userData.balance < (training.price || 0)) || isCancelled ? 'disabled' : ''}>
                                <i class="fas fa-calendar-plus"></i> ${isCancelled ? 'Отменена' : 'Записаться'}
                            </button>
                            <button onclick="viewTrainingDetails('${doc.id}')" class="btn-secondary" style="flex: 1;">
                                <i class="fas fa-info-circle"></i> Подробнее
                            </button>
                        </div>
                    `}
                </div>
            `;
            
            container.appendChild(card);
        });
        
        // Обновляем кнопку "Показать еще"
        updateLoadMoreButton();
        
    } catch (error) {
        console.error('Ошибка загрузки тренировок:', error);
        document.getElementById('trainingsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

// Кнопка "Показать еще"
function updateLoadMoreButton() {
    let loadMoreBtn = document.getElementById('loadMoreTrainings');
    
    if (!loadMoreBtn) {
        loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreTrainings';
        loadMoreBtn.className = 'btn-secondary';
        loadMoreBtn.style.width = '100%';
        loadMoreBtn.style.marginTop = '20px';
        loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Показать еще';
        loadMoreBtn.onclick = () => loadTrainings(true);
        
        document.getElementById('trainingsList').parentNode.appendChild(loadMoreBtn);
    }
    
    if (!trainingsHasMore) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }
}

// Добавление фильтров
function addFiltersToSchedule() {
    const scheduleScreen = document.getElementById('scheduleScreen');
    
    const filterPanel = document.createElement('div');
    filterPanel.id = 'trainingsFilters';
    filterPanel.style.cssText = `
        background: white;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 20px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    filterPanel.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
                <input type="text" id="searchTrainings" placeholder="Поиск тренировок..." 
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div>
                <select id="filterDate" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Все даты</option>
                    <option value="today">Сегодня</option>
                    <option value="tomorrow">Завтра</option>
                    <option value="week">Эта неделя</option>
                    <option value="month">Этот месяц</option>
                </select>
            </div>
            
            <div>
                <select id="filterPrice" style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Любая цена</option>
                    <option value="free">Бесплатные</option>
                    <option value="0-100">0-100 баллов</option>
                    <option value="100-500">100-500 баллов</option>
                    <option value="500+">500+ баллов</option>
                </select>
            </div>
            
            <button onclick="applyFilters()" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">
                <i class="fas fa-filter"></i> Применить
            </button>
            
            <button onclick="resetFilters()" style="
                background: #6c757d;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">
                <i class="fas fa-times"></i> Сбросить
            </button>
        </div>
        
        <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;" id="activeFilters">
        </div>
    `;
    
    const trainingsContainer = scheduleScreen.querySelector('.content');
    trainingsContainer.insertBefore(filterPanel, trainingsContainer.firstChild);
    
    // Обработчики событий
    document.getElementById('searchTrainings').addEventListener('input', debounce(applyFilters, 500));
    document.getElementById('filterDate').addEventListener('change', applyFilters);
    document.getElementById('filterPrice').addEventListener('change', applyFilters);
}

// Функция задержки
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Применение фильтров
async function applyFilters() {
    const searchTerm = document.getElementById('searchTrainings').value.toLowerCase();
    const dateFilter = document.getElementById('filterDate').value;
    const priceFilter = document.getElementById('filterPrice').value;
    
    // Показываем активные фильтры
    const activeFiltersContainer = document.getElementById('activeFilters');
    activeFiltersContainer.innerHTML = '';
    
    const filters = [];
    if (searchTerm) filters.push(`Поиск: "${searchTerm}"`);
    if (dateFilter) filters.push(`Дата: ${document.getElementById('filterDate').options[document.getElementById('filterDate').selectedIndex].text}`);
    if (priceFilter) filters.push(`Цена: ${document.getElementById('filterPrice').options[document.getElementById('filterPrice').selectedIndex].text}`);
    
    filters.forEach(filter => {
        const badge = document.createElement('span');
        badge.style.cssText = `
            background: #e3f2fd;
            color: #1976d2;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.85em;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        `;
        badge.innerHTML = `${filter} <i class="fas fa-times" style="cursor: pointer;" onclick="removeFilter('${filter.split(':')[0].trim()}')"></i>`;
        activeFiltersContainer.appendChild(badge);
    });
    
    // Загружаем заново
    loadTrainings();
}

// Сброс фильтров
function resetFilters() {
    document.getElementById('searchTrainings').value = '';
    document.getElementById('filterDate').selectedIndex = 0;
    document.getElementById('filterPrice').selectedIndex = 0;
    document.getElementById('activeFilters').innerHTML = '';
    loadTrainings();
}

// Удаление фильтра
function removeFilter(filterType) {
    switch(filterType) {
        case 'Поиск':
            document.getElementById('searchTrainings').value = '';
            break;
        case 'Дата':
            document.getElementById('filterDate').selectedIndex = 0;
            break;
        case 'Цена':
            document.getElementById('filterPrice').selectedIndex = 0;
            break;
    }
    applyFilters();
}

// ============================================
// 🔔 СИСТЕМА УВЕДОМЛЕНИЙ
// ============================================

// Инициализация уведомлений
async function initNotifications() {
    if (!currentUser) return;
    
    // Останавливаем предыдущий слушатель
    if (notificationsListener) {
        notificationsListener();
    }
    
    // Загружаем уведомления
    await loadNotifications();
    
    // Слушаем новые уведомления
    notificationsListener = db.collection('notifications')
        .where('userId', '==', currentUser.uid)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(async (snapshot) => {
            if (!snapshot.empty) {
                await loadNotifications();
                updateNotificationBadge();
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        showNotificationToast(change.doc.data());
                    }
                });
            }
        });
}

// Загрузка уведомлений
async function loadNotifications() {
    try {
        const querySnapshot = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const container = document.getElementById('notificationsList');
        if (!container) return;
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет уведомлений</p>';
            return;
        }
        
        let html = '<div class="notifications-container">';
        
        querySnapshot.forEach(doc => {
            const notification = doc.data();
            const date = notification.createdAt?.toDate() || new Date();
            const icon = getNotificationIcon(notification.type);
            const timeAgo = getTimeAgo(date);
            
            html += `
                <div class="notification-item ${notification.read ? '' : 'unread'}" 
                     onclick="openNotification('${doc.id}', '${notification.type}', '${notification.trainingId || ''}')">
                    <div class="notification-icon" style="background: ${getNotificationColor(notification.type)}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${getNotificationTitle(notification.type)}</div>
                        <div class="notification-message">${notification.message || getNotificationMessage(notification)}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    ${!notification.read ? '<div class="notification-dot"></div>' : ''}
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        updateNotificationBadge();
        
    } catch (error) {
        console.error('Ошибка загрузки уведомлений:', error);
    }
}

// Вспомогательные функции уведомлений
function getNotificationIcon(type) {
    switch(type) {
        case 'training_created': return 'fas fa-dumbbell';
        case 'training_cancelled': return 'fas fa-ban';
        case 'registration_confirmed': return 'fas fa-calendar-check';
        case 'attendance_confirmed': return 'fas fa-user-check';
        case 'balance_updated': return 'fas fa-coins';
        case 'rating_received': return 'fas fa-star';
        case 'message': return 'fas fa-comment';
        case 'system': return 'fas fa-info-circle';
        default: return 'fas fa-bell';
    }
}

function getNotificationColor(type) {
    switch(type) {
        case 'training_created': return '#4CAF50';
        case 'training_cancelled': return '#f44336';
        case 'registration_confirmed': return '#2196F3';
        case 'attendance_confirmed': return '#FF9800';
        case 'balance_updated': return '#9C27B0';
        case 'rating_received': return '#FFC107';
        default: return '#607D8B';
    }
}

function getNotificationTitle(type) {
    switch(type) {
        case 'training_created': return 'Новая тренировка';
        case 'training_cancelled': return 'Тренировка отменена';
        case 'registration_confirmed': return 'Запись подтверждена';
        case 'attendance_confirmed': return 'Посещение отмечено';
        case 'balance_updated': return 'Изменение баланса';
        case 'rating_received': return 'Новая оценка';
        case 'message': return 'Новое сообщение';
        default: return 'Уведомление';
    }
}

function getNotificationMessage(notification) {
    if (notification.message) return notification.message;
    
    switch(notification.type) {
        case 'training_created': return 'Добавлена новая тренировка';
        case 'training_cancelled': return 'Тренировка была отменена';
        case 'registration_confirmed': return 'Ваша запись подтверждена';
        case 'attendance_confirmed': return 'Ваше посещение отмечено';
        case 'balance_updated': return `Баланс изменен на ${notification.amount || 0} баллов`;
        case 'rating_received': return 'Вы получили новую оценку';
        default: return 'У вас новое уведомление';
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString();
}

// Открытие уведомления
async function openNotification(notificationId, type, trainingId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        switch(type) {
            case 'training_created':
            case 'training_cancelled':
                if (trainingId) viewTrainingDetails(trainingId);
                break;
            case 'registration_confirmed':
                showScreen('myBookings');
                break;
            case 'balance_updated':
                showScreen('balance');
                break;
            case 'rating_received':
                showScreen('ratings');
                break;
        }
        
        closeModal('notificationsModal');
        
    } catch (error) {
        console.error('Ошибка открытия уведомления:', error);
    }
}

// Создание уведомления
async function createNotification(userId, type, data = {}) {
    try {
        const notificationData = {
            userId: userId,
            type: type,
            ...data,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('notifications').add(notificationData);
        
    } catch (error) {
        console.error('Ошибка создания уведомления:', error);
    }
}

// Показ тоста
function showNotificationToast(notification) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        min-width: 300px;
        max-width: 400px;
        border-left: 4px solid ${getNotificationColor(notification.type)};
        animation: slideIn 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="color: ${getNotificationColor(notification.type)}; font-size: 20px;">
                <i class="${getNotificationIcon(notification.type)}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 5px;">${getNotificationTitle(notification.type)}</div>
                <div style="font-size: 0.9em; color: #666;">${notification.message || getNotificationMessage(notification)}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                padding: 0;
                font-size: 18px;
            ">×</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

// Обновление бэйджа
async function updateNotificationBadge() {
    try {
        const unreadCount = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .get()
            .then(snapshot => snapshot.size);
        
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка обновления бэйджа:', error);
    }
}

// Открытие модального окна уведомлений
function openNotificationsModal() {
    openModal('notificationsModal');
    loadNotifications();
}

// Отметить все как прочитанные
async function markAllAsRead() {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .get();
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, {
                read: true,
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        
        alert('✅ Все уведомления отмечены как прочитанные');
        await loadNotifications();
        updateNotificationBadge();
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// Добавление кнопки уведомлений
function addNotificationsButton() {
    const bottomNav = document.querySelector('.bottom-nav');
    
    const notificationBtn = document.createElement('div');
    notificationBtn.className = 'nav-btn';
    notificationBtn.innerHTML = `
        <i class="fas fa-bell"></i>
        <span>Уведомления</span>
        <div id="notificationBadge" style="
            display: none;
            position: absolute;
            top: 5px;
            right: 10px;
            background: #ff4757;
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        ">0</div>
    `;
    
    notificationBtn.onclick = openNotificationsModal;
    bottomNav.insertBefore(notificationBtn, bottomNav.children[bottomNav.children.length - 1]);
}

// ============================================
// 👑 АДМИН-ПАНЕЛЬ
// ============================================

// Проверка прав админа
function isAdmin() {
    return userData && userData.role === 'admin';
}

// Загрузка админ-панели
async function loadAdminPanel() {
    if (!isAdmin()) return;
    
    const adminScreen = document.createElement('div');
    adminScreen.id = 'adminScreen';
    adminScreen.className = 'screen';
    adminScreen.innerHTML = `
        <div class="container">
            <div class="header">
                <h2><i class="fas fa-crown"></i> Админ-панель</h2>
                <button onclick="showScreen('schedule')" class="btn-secondary">
                    <i class="fas fa-arrow-left"></i> Назад
                </button>
            </div>
            
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #4CAF50;">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalUsers">0</div>
                            <div class="stat-label">Всего пользователей</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #2196F3;">
                            <i class="fas fa-dumbbell"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalTrainings">0</div>
                            <div class="stat-label">Тренировок всего</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #FF9800;">
                            <i class="fas fa-coins"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalBalance">0</div>
                            <div class="stat-label">Всего баллов в системе</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #9C27B0;">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalRegistrations">0</div>
                            <div class="stat-label">Всего записей</div>
                        </div>
                    </div>
                </div>
                
                <div class="tabs" style="margin-top: 30px;">
                    <div class="tab-buttons">
                        <button class="tab-btn active" onclick="switchAdminTab('users')">
                            <i class="fas fa-users"></i> Пользователи
                        </button>
                        <button class="tab-btn" onclick="switchAdminTab('trainings')">
                            <i class="fas fa-dumbbell"></i> Тренировки
                        </button>
                        <button class="tab-btn" onclick="switchAdminTab('transactions')">
                            <i class="fas fa-exchange-alt"></i> Транзакции
                        </button>
                        <button class="tab-btn" onclick="switchAdminTab('reports')">
                            <i class="fas fa-chart-bar"></i> Отчеты
                        </button>
                    </div>
                    
                    <div class="tab-content">
                        <div id="adminTabUsers" class="tab-pane active">
                            <div class="table-container">
                                <table id="usersTable">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Имя</th>
                                            <th>Email</th>
                                            <th>Роль</th>
                                            <th>Баланс</th>
                                            <th>Дата регистрации</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody id="usersTableBody">
                                        <!-- Данные загружаются динамически -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div id="adminTabTrainings" class="tab-pane">
                            <div id="adminTrainingsList"></div>
                        </div>
                        
                        <div id="adminTabTransactions" class="tab-pane">
                            <div id="adminTransactionsList"></div>
                        </div>
                        
                        <div id="adminTabReports" class="tab-pane">
                            <div id="adminReports"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.querySelector('.screens').appendChild(adminScreen);
}

// Загрузка статистики админа
async function loadAdminStats() {
    try {
        const usersSnapshot = await db.collection('users').get();
        document.getElementById('totalUsers').textContent = usersSnapshot.size;
        
        const trainingsSnapshot = await db.collection('trainings').get();
        document.getElementById('totalTrainings').textContent = trainingsSnapshot.size;
        
        let totalBalance = 0;
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            totalBalance += user.balance || 0;
        });
        document.getElementById('totalBalance').textContent = totalBalance;
        
        const registrationsSnapshot = await db.collection('registrations').get();
        document.getElementById('totalRegistrations').textContent = registrationsSnapshot.size;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики админа:', error);
    }
}

// Загрузка пользователей для админа
async function loadAdminUsers() {
    try {
        const usersSnapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const createdAt = user.createdAt?.toDate() || new Date();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${doc.id.substring(0, 8)}...</td>
                <td>${user.name || '-'}</td>
                <td>${user.email || '-'}</td>
                <td>
                    <select class="role-select" data-user="${doc.id}" style="padding: 5px; border-radius: 3px; border: 1px solid #ddd;">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                        <option value="trainer" ${user.role === 'trainer' ? 'selected' : ''}>Тренер</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Админ</option>
                    </select>
                </td>
                <td>
                    <input type="number" value="${user.balance || 0}" 
                           data-user="${doc.id}" 
                           class="balance-input"
                           style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 3px;">
                </td>
                <td>${createdAt.toLocaleDateString()}</td>
                <td>
                    <button onclick="editUserAsAdmin('${doc.id}')" class="btn-sm" style="margin-right: 5px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteUserAsAdmin('${doc.id}')" class="btn-sm btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Обработчики событий
        document.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.user;
                const newRole = e.target.value;
                
                if (confirm(`Изменить роль пользователя на "${newRole}"?`)) {
                    try {
                        await db.collection('users').doc(userId).update({
                            role: newRole
                        });
                        alert('✅ Роль обновлена');
                    } catch (error) {
                        alert('❌ Ошибка: ' + error.message);
                    }
                }
            });
        });
        
        document.querySelectorAll('.balance-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const userId = e.target.dataset.user;
                const newBalance = parseInt(e.target.value);
                
                if (isNaN(newBalance)) {
                    alert('Введите корректное число');
                    return;
                }
                
                if (confirm(`Изменить баланс пользователя на ${newBalance}?`)) {
                    try {
                        await db.collection('users').doc(userId).update({
                            balance: newBalance
                        });
                        
                        await db.collection('transactions').add({
                            userId: userId,
                            amount: newBalance,
                            type: 'admin_adjustment',
                            description: 'Корректировка баланса администратором',
                            createdBy: currentUser.uid,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        alert('✅ Баланс обновлен');
                    } catch (error) {
                        alert('❌ Ошибка: ' + error.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('usersTableBody').innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #f44336;">
                    Ошибка загрузки данных
                </td>
            </tr>
        `;
    }
}

// Переключение вкладок админ-панели
async function switchAdminTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    document.getElementById(`adminTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
    
    switch(tabName) {
        case 'users':
            await loadAdminUsers();
            break;
        case 'trainings':
            await loadAdminTrainings();
            break;
        case 'transactions':
            await loadAdminTransactions();
            break;
        case 'reports':
            await loadAdminReports();
            break;
    }
}

// Загрузка тренировок для админа
async function loadAdminTrainings() {
    try {
        const trainingsSnapshot = await db.collection('trainings')
            .orderBy('date', 'desc')
            .limit(50)
            .get();
        
        const container = document.getElementById('adminTrainingsList');
        let html = `
            <div style="margin-bottom: 20px;">
                <button onclick="adminCreateTraining()" class="btn-primary">
                    <i class="fas fa-plus"></i> Создать тренировку
                </button>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 12px; text-align: left;">Название</th>
                        <th style="padding: 12px; text-align: left;">Дата</th>
                        <th style="padding: 12px; text-align: left;">Тренер</th>
                        <th style="padding: 12px; text-align: left;">Цена</th>
                        <th style="padding: 12px; text-align: left;">Статус</th>
                        <th style="padding: 12px; text-align: left;">Участники</th>
                        <th style="padding: 12px; text-align: left;">Действия</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        trainingsSnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date?.toDate() || new Date();
            
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${training.title || '-'}</td>
                    <td style="padding: 10px;">${date.toLocaleDateString()}</td>
                    <td style="padding: 10px;">${training.trainerName || '-'}</td>
                    <td style="padding: 10px;">${training.price || 0} баллов</td>
                    <td style="padding: 10px;">
                        ${training.cancelled ? 
                            '<span style="color: #f44336;">Отменена</span>' : 
                            '<span style="color: #4CAF50;">Активна</span>'}
                    </td>
                    <td style="padding: 10px;">
                        <button onclick="viewTrainingParticipants('${doc.id}')" class="btn-sm">
                            <i class="fas fa-users"></i> Показать
                        </button>
                    </td>
                    <td style="padding: 10px;">
                        <button onclick="editTrainingAsAdmin('${doc.id}')" class="btn-sm" style="margin-right: 5px;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteTrainingAsAdmin('${doc.id}')" class="btn-sm btn-danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка загрузки тренировок:', error);
        document.getElementById('adminTrainingsList').innerHTML = '<p style="color: #f44336;">Ошибка загрузки данных</p>';
    }
}

// Добавление кнопки админа
function addAdminButton() {
    if (!isAdmin()) return;
    
    const bottomNav = document.querySelector('.bottom-nav');
    
    const adminBtn = document.createElement('div');
    adminBtn.className = 'nav-btn';
    adminBtn.innerHTML = `
        <i class="fas fa-crown"></i>
        <span>Админ</span>
    `;
    
    adminBtn.onclick = () => {
        if (!document.getElementById('adminScreen')) {
            loadAdminPanel();
        }
        showScreen('admin');
    };
    
    bottomNav.appendChild(adminBtn);
}

// ============================================
// 📊 СТАТИСТИКА В ВИДЕ ГРАФИКОВ
// ============================================

// Загрузка графиков посещений
async function loadAttendanceCharts() {
    if (!userData) return;
    
    const container = document.createElement('div');
    container.id = 'chartsContainer';
    container.style.cssText = `
        margin-top: 30px;
        padding: 20px;
        background: white;
        border-radius: 15px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    container.innerHTML = `
        <h3 style="margin-bottom: 20px;"><i class="fas fa-chart-bar"></i> Статистика посещений</h3>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div>
                <canvas id="attendanceByMonthChart"></canvas>
            </div>
            <div>
                <canvas id="attendanceByTrainingChart"></canvas>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <div>
                <canvas id="revenueByMonthChart"></canvas>
            </div>
            <div>
                <canvas id="userActivityChart"></canvas>
            </div>
        </div>
    `;
    
    const trainerStats = document.getElementById('trainerStats');
    if (trainerStats) {
        trainerStats.appendChild(container);
        
        setTimeout(async () => {
            await loadAttendanceData();
        }, 1000);
    }
}

// Загрузка данных для графиков
async function loadAttendanceData() {
    if (!userData) return;
    
    try {
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .orderBy('date')
            .get();
        
        if (trainingsSnapshot.empty) {
            console.log('Нет тренировок для построения графиков');
            return;
        }
        
        const monthlyData = {};
        const trainingData = {};
        const revenueByMonth = {};
        let totalParticipants = 0;
        let totalRevenue = 0;
        
        for (const doc of trainingsSnapshot.docs) {
            const training = doc.data();
            const date = training.date.toDate();
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', doc.id)
                .where('attended', '==', true)
                .get();
            
            const participants = registrationsSnapshot.size;
            const revenue = participants * (training.price || 0);
            
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {
                    name: monthName,
                    participants: 0,
                    trainings: 0,
                    revenue: 0
                };
            }
            monthlyData[monthYear].participants += participants;
            monthlyData[monthYear].trainings += 1;
            monthlyData[monthYear].revenue += revenue;
            
            trainingData[training.title || 'Без названия'] = participants;
            
            if (!revenueByMonth[monthYear]) {
                revenueByMonth[monthYear] = {
                    name: monthName,
                    revenue: 0
                };
            }
            revenueByMonth[monthYear].revenue += revenue;
            
            totalParticipants += participants;
            totalRevenue += revenue;
        }
        
        const sortedMonths = Object.keys(monthlyData).sort();
        const sortedTrainingData = Object.entries(trainingData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        // Строим графики
        createAttendanceByMonthChart(sortedMonths.map(m => monthlyData[m].name), sortedMonths.map(m => monthlyData[m].participants));
        createAttendanceByTrainingChart(sortedTrainingData.map(t => t[0]), sortedTrainingData.map(t => t[1]));
        createRevenueByMonthChart(sortedMonths.map(m => monthlyData[m].name), sortedMonths.map(m => monthlyData[m].revenue));
        createUserActivityChart(totalParticipants, totalRevenue, trainingsSnapshot.size);
        
    } catch (error) {
        console.error('Ошибка загрузки данных для графиков:', error);
    }
}

// График посещаемости по месяцам
function createAttendanceByMonthChart(labels, data) {
    const ctx = document.getElementById('attendanceByMonthChart');
    if (!ctx) return;
    
    new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Посещения',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Посещаемость по месяцам'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Количество посещений'
                    }
                }
            }
        }
    });
}

// График посещаемости по тренировкам
function createAttendanceByTrainingChart(labels, data) {
    const ctx = document.getElementById('attendanceByTrainingChart');
    if (!ctx) return;
    
    new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Посещения',
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#8AC926', '#1982C4',
                    '#6A4C93', '#FF595E'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Распределение по тренировкам'
                }
            }
        }
    });
}

// График доходов по месяцам
function createRevenueByMonthChart(labels, data) {
    const ctx = document.getElementById('revenueByMonthChart');
    if (!ctx) return;
    
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Доход (баллы)',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Динамика доходов'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Баллы'
                    }
                }
            }
        }
    });
}

// График активности пользователей
function createUserActivityChart(totalParticipants, totalRevenue, totalTrainings) {
    const ctx = document.getElementById('userActivityChart');
    if (!ctx) return;
    
    const avgParticipantsPerTraining = totalTrainings > 0 ? (totalParticipants / totalTrainings).toFixed(1) : 0;
    const avgRevenuePerTraining = totalTrainings > 0 ? (totalRevenue / totalTrainings).toFixed(0) : 0;
    
    new Chart(ctx.getContext('2d'), {
        type: 'radar',
        data: {
            labels: ['Всего посещений', 'Всего доход', 'Тренировок', 'Сред. посещаемость', 'Сред. доход'],
            datasets: [{
                label: 'Показатели',
                data: [
                    totalParticipants,
                    totalRevenue / 100,
                    totalTrainings,
                    avgParticipantsPerTraining * 10,
                    avgRevenuePerTraining / 10
                ],
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Общая активность'
                }
            },
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });
}

// ============================================
// 🎯 ОБРАБОТЧИКИ СОБЫТИЙ И ИНИЦИАЛИЗАЦИЯ
// ============================================

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const screen = this.dataset.screen;
            if (screen) showScreen(screen);
        });
    });
    
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    document.querySelectorAll('.demo-accounts p').forEach(p => {
        p.addEventListener('click', function(e) {
            if (e.target.textContent.includes('user@test.com')) {
                document.getElementById('loginEmail').value = 'user@test.com';
                document.getElementById('loginPassword').value = '123456';
            } else if (e.target.textContent.includes('trainer@test.com')) {
                document.getElementById('loginEmail').value = 'trainer@test.com';
                document.getElementById('loginPassword').value = '123456';
            }
        });
    });
    
    document.getElementById('loginEmail')?.focus();
});

// Обработчик авторизации
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        
        // Инициализация функций для авторизованного пользователя
        setTimeout(() => {
            if (userData.role === 'trainer' || userData.role === 'admin') {
                initNotifications();
                addNotificationsButton();
                addAdminButton();
            }
            
            if (document.getElementById('scheduleScreen').classList.contains('active')) {
                addFiltersToSchedule();
            }
        }, 1000);
        
        document.getElementById('loginScreen').classList.remove('active');
        showScreen('schedule');
    } else {
        currentUser = null;
        userData = null;
        
        if (notificationsListener) {
            notificationsListener();
            notificationsListener = null;
        }
        
        document.getElementById('loginScreen').classList.add('active');
        document.querySelectorAll('.screen:not(#loginScreen)').forEach(screen => {
            screen.classList.remove('active');
        });
        document.querySelector('.bottom-nav').style.display = 'none';
        
        document.getElementById('logoutBtn').classList.add('hidden');
        document.getElementById('userName').textContent = 'Гость';
    }
});

// Добавление CSS стилей
const styles = `
<style>
/* Анимации */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

/* Базовые стили */
.training-card {
    animation: fadeIn 0.3s ease;
}

.notification-toast {
    animation: slideIn 0.3s ease;
}

/* Уведомления */
.notifications-container {
    max-height: 500px;
    overflow-y: auto;
}

.notification-item {
    display: flex;
    align-items: flex-start;
    gap: 15px;
    padding: 15px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background 0.2s;
}

.notification-item:hover {
    background: #f8f9fa;
}

.notification-item.unread {
    background: #f0f8ff;
}

.notification-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 18px;
}

.notification-content {
    flex: 1;
}

.notification-title {
    font-weight: 600;
    margin-bottom: 5px;
    color: #333;
}

.notification-message {
    font-size: 0.95em;
    color: #666;
    margin-bottom: 5px;
    line-height: 1.4;
}

.notification-time {
    font-size: 0.85em;
    color: #999;
}

.notification-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff4757;
    margin-top: 5px;
}

/* Админ панель */
.stat-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #333;
}

.stat-label {
    font-size: 0.9em;
    color: #666;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.tabs {
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.tab-buttons {
    display: flex;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.tab-btn {
    padding: 15px 20px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #495057;
    border-bottom: 3px solid transparent;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 8px;
}

.tab-btn:hover {
    background: #e9ecef;
}

.tab-btn.active {
    color: #667eea;
    border-bottom-color: #667eea;
    background: white;
}

.tab-content {
    padding: 20px;
}

.tab-pane {
    display: none;
}

.tab-pane.active {
    display: block;
}

.table-container {
    overflow-x: auto;
}

#usersTable {
    width: 100%;
    border-collapse: collapse;
}

#usersTable th, #usersTable td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
}

#usersTable th {
    background: #f8f9fa;
    font-weight: 600;
    color: #495057;
}

#usersTable tr:hover {
    background: #f8f9fa;
}

.btn-sm {
    padding: 5px 10px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
}

.btn-danger {
    background: #f44336;
    color: white;
}

.loading-spinner {
    text-align: center;
    padding: 40px;
    color: #667eea;
    font-size: 18px;
}

/* Адаптивность */
@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    .header {
        flex-direction: column;
        gap: 10px;
        text-align: center;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .tab-buttons {
        flex-wrap: wrap;
    }
    
    .tab-btn {
        flex: 1;
        min-width: 120px;
        justify-content: center;
    }
    
    .training-card {
        margin: 10px 0;
    }
    
    table {
        font-size: 14px;
    }
    
    #trainingsFilters > div {
        flex-direction: column;
        gap: 10px;
    }
    
    #trainingsFilters input,
    #trainingsFilters select {
        width: 100%;
    }
}

@media (max-width: 480px) {
    .bottom-nav {
        padding: 10px 5px;
    }
    
    .nav-btn {
        font-size: 12px;
        padding: 8px 5px;
    }
    
    .modal-content {
        width: 95%;
        margin: 10px;
        padding: 15px;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', styles);

// HTML для модального окна уведомлений
const notificationsModalHTML = `
<div id="notificationsModal" class="modal" style="display: none;">
    <div class="modal-content" style="max-width: 500px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3><i class="fas fa-bell"></i> Уведомления</h3>
            <div style="display: flex; gap: 10px;">
                <button onclick="markAllAsRead()" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.9em;
                ">
                    <i class="fas fa-check-double"></i> Прочитать все
                </button>
                <button onclick="closeModal('notificationsModal')" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
            </div>
        </div>
        <div id="notificationsList"></div>
    </div>
</div>
`;

document.body.insertAdjacentHTML('beforeend', notificationsModalHTML);

// Экспорт всех функций в глобальную область видимости
window.showScreen = showScreen;
window.openModal = openModal;
window.closeModal = closeModal;
window.register = register;
window.login = login;
window.logout = logout;
window.refreshSchedule = function() { loadTrainings(); alert('Обновлено!'); };
window.openCreateTrainingModal = function() {
    if (userData.role !== 'trainer') return alert('Только тренер');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    
    document.getElementById('trainingDate').value = tomorrow.toISOString().slice(0, 16);
    openModal('createTrainingModal');
};
window.createTraining = async function() {
    if (userData.role !== 'trainer') return alert('Только тренер');
    
    const title = document.getElementById('trainingTitle').value;
    const date = document.getElementById('trainingDate').value;
    const price = document.getElementById('trainingPrice').value;
    const max = document.getElementById('trainingMax').value;
    const desc = document.getElementById('trainingDesc').value;
    
    if (!title || !date || !price) return alert('Заполните обязательные поля');
    
    try {
        await db.collection('trainings').add({
            title: title,
            date: firebase.firestore.Timestamp.fromDate(new Date(date)),
            price: parseInt(price),
            maxParticipants: max ? parseInt(max) : null,
            description: desc || '',
            trainerId: currentUser.uid,
            trainerName: userData.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Тренировка создана!');
        closeModal('createTrainingModal');
        loadTrainings();
        
        document.getElementById('trainingTitle').value = '';
        document.getElementById('trainingPrice').value = '';
        document.getElementById('trainingDesc').value = '';
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

// Добавляем остальные функции в window
window.openAttendanceModal = openAttendanceModal;
window.saveAttendance = async function() {
    console.log('Функция saveAttendance вызвана');
    const trainingId = document.getElementById('attendanceTraining').value;
    
    if (!trainingId) {
        alert('❌ Выберите тренировку для отметки присутствия');
        return;
    }
    
    const checkboxes = document.querySelectorAll('#attendanceUsers input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('⚠️ Выберите участников для отметки');
        return;
    }
    
    let updated = 0;
    
    try {
        const trainingDoc = await db.collection('trainings').doc(trainingId).get();
        const training = trainingDoc.data();
        const price = training.price || 0;
        
        for (const checkbox of checkboxes) {
            const registrationId = checkbox.dataset.registration;
            const userId = checkbox.dataset.user;
            
            try {
                await db.runTransaction(async (transaction) => {
                    const registrationRef = db.collection('registrations').doc(registrationId);
                    const registrationDoc = await transaction.get(registrationRef);
                    const registration = registrationDoc.data();
                    
                    if (registration.charged) return;
                    
                    const userRef = db.collection('users').doc(userId);
                    const userDoc = await transaction.get(userRef);
                    
                    if (!userDoc.exists) throw new Error('Пользователь не найден');
                    
                    const userBalance = userDoc.data().balance || 0;
                    
                    if (userBalance < price) {
                        throw new Error('Недостаточно баллов');
                    }
                    
                    transaction.update(userRef, { balance: userBalance - price });
                    
                    if (training.trainerId) {
                        const trainerRef = db.collection('users').doc(training.trainerId);
                        const trainerDoc = await transaction.get(trainerRef);
                        
                        if (trainerDoc.exists) {
                            const trainerBalance = trainerDoc.data().balance || 0;
                            transaction.update(trainerRef, { balance: trainerBalance + price });
                        }
                    }
                    
                    transaction.update(registrationRef, {
                        attended: true,
                        charged: true,
                        attendedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                updated++;
            } catch (error) {
                console.error(`Ошибка обработки пользователя ${userId}:`, error);
            }
        }
        
        alert(`✅ Отмечено ${updated} участников`);
        closeModal('attendanceModal');
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

window.openAdjustBalanceModal = openAdjustBalanceModal;
window.saveBalanceAdjustment = async function() {
    const userSelect = document.getElementById('balanceUser');
    const amountInput = document.getElementById('balanceAdjustAmount');
    const reasonInput = document.getElementById('balanceReason');
    
    const userId = userSelect.value;
    const amount = parseFloat(amountInput.value);
    const reason = reasonInput.value.trim();
    
    if (!userId) return alert('Выберите пользователя');
    if (!amount || isNaN(amount)) return alert('Введите корректную сумму');
    if (!reason) return alert('Укажите причину');
    
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) throw new Error('Пользователь не найден');
            
            const currentBalance = userDoc.data().balance || 0;
            const newBalance = currentBalance + amount;
            
            transaction.update(userRef, { balance: newBalance });
            
            const transRef = db.collection('transactions').doc();
            transaction.set(transRef, {
                userId: userId,
                amount: Math.abs(amount),
                type: amount >= 0 ? 'credit' : 'debit',
                description: reason,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        alert(`✅ Успешно! ${amount >= 0 ? 'Начислено' : 'Списано'} ${Math.abs(amount)} баллов`);
        closeModal('balanceModal');
        loadUserData();
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
};

// Добавьте остальные функции по аналогии...

// Если нужны другие функции из оригинального кода, добавьте их здесь
