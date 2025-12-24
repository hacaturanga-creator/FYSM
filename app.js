// ============================================
// FITBOOK - ИСПРАВЛЕННОЕ ПРИЛОЖЕНИЕ
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyD5gplXXpP69H0f0WDQehy4jLOOTnw2rZQ",
    authDomain: "fysm-2d26a.firebaseapp.com",
    projectId: "fysm-2d26a",
    storageBucket: "fysm-2d26a.firebasestorage.app",
    messagingSenderId: "1013209595020",
    appId: "1:1013209595020:web:5057a63c94dbf29aa4cfa9"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = null;
let selectedTrainingId = null;
let selectedTrainingPrice = 0;

// ============================================
// 🔐 ОСНОВНЫЕ ФУНКЦИИ
// ============================================

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
        case 'schedule': loadTrainings(); break;
        case 'balance': loadTransactions(); break;
        case 'myBookings': loadMyBookings(); break;
        case 'ratings': loadMyRatings(); break;
        case 'trainer': loadTrainerStats(); break;
    }
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

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

async function logout() {
    if (confirm('Выйти?')) await auth.signOut();
}

async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            updateUI();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

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
// 🏋️‍♂️ ТРЕНИРОВКИ
// ============================================

async function loadTrainings() {
    try {
        const querySnapshot = await db.collection('trainings')
            .where('date', '>=', firebase.firestore.Timestamp.now())
            .orderBy('date')
            .limit(20)
            .get();
        
        const container = document.getElementById('trainingsList');
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет тренировок</p>';
            return;
        }
        
        querySnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date.toDate();
            
            const card = document.createElement('div');
            card.className = 'training-card';
            card.innerHTML = `
                <h3>${training.title || 'Без названия'}</h3>
                <div class="training-meta">
                    <span><i class="far fa-calendar"></i> ${date.toLocaleDateString()}</span>
                    <span><i class="far fa-clock"></i> ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span><i class="fas fa-coins"></i> ${training.price || 0} баллов</span>
                </div>
                ${training.description ? `<p>${training.description}</p>` : ''}
                ${training.trainerName ? `<p><small><i class="fas fa-user-tie"></i> ${training.trainerName}</small></p>` : ''}
                
                <div class="mt-2">
                    ${userData && userData.role === 'trainer' ? `
                        <button onclick="editTraining('${doc.id}')" class="btn-secondary" style="width:100%;">
                            <i class="fas fa-edit"></i> Редактировать
                        </button>
                    ` : `
                        <button onclick="openRegisterModal('${doc.id}', ${training.price || 0}, '${training.title}')" 
                                class="btn-primary" style="width:100%;"
                                ${userData && userData.balance < (training.price || 0) ? 'disabled' : ''}>
                            <i class="fas fa-calendar-plus"></i> Записаться
                        </button>
                    `}
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('trainingsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

function refreshSchedule() {
    loadTrainings();
    alert('Обновлено!');
}

// ============================================
// 💰 БАЛАНС И ТРАНЗАКЦИИ
// ============================================

async function loadTransactions() {
    try {
        const querySnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const container = document.getElementById('transactionsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет транзакций</p>';
            return;
        }
        
        const transactions = [];
        querySnapshot.forEach(doc => {
            const trans = doc.data();
            trans.id = doc.id;
            transactions.push(trans);
        });
        
        transactions.sort((a, b) => {
            const dateA = a.createdAt?.toDate() || new Date(0);
            const dateB = b.createdAt?.toDate() || new Date(0);
            return dateB - dateA;
        });
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Описание</th>
                        <th>Сумма</th>
                        <th>Тип</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        transactions.slice(0, 20).forEach(trans => {
            const date = trans.createdAt?.toDate() || new Date();
            const typeClass = trans.type === 'credit' ? 'status-success' : 'status-danger';
            
            html += `
                <tr>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${trans.description || '-'}</td>
                    <td>${trans.amount}</td>
                    <td><span class="status-badge ${typeClass}">${trans.type === 'credit' ? 'Начисление' : 'Списание'}</span></td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('transactionsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

// ============================================
// 📝 МОИ ЗАПИСИ
// ============================================

async function loadMyBookings() {
    try {
        const querySnapshot = await db.collection('registrations')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const container = document.getElementById('myBookingsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет записей</p>';
            return;
        }
        
        const registrations = [];
        querySnapshot.forEach(doc => {
            const reg = doc.data();
            reg.id = doc.id;
            registrations.push(reg);
        });
        
        const trainingPromises = registrations.map(reg => 
            db.collection('trainings').doc(reg.trainingId).get()
        );
        
        const trainingSnapshots = await Promise.all(trainingPromises);
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Тренировка</th>
                        <th>Дата</th>
                        <th>Стоимость</th>
                        <th>Статус</th>
                        <th>Присутствие</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        registrations.forEach((reg, index) => {
            const training = trainingSnapshots[index].exists ? trainingSnapshots[index].data() : {};
            const date = training.date?.toDate() || new Date();
            const statusClass = reg.attended ? 'status-success' : 'status-warning';
            const attendanceClass = reg.attended ? 'status-success' : 'status-danger';
            
            html += `
                <tr>
                    <td>${training.title || 'Неизвестно'}</td>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${training.price || 0} баллов</td>
                    <td><span class="status-badge ${statusClass}">${reg.charged ? 'Оплачено' : 'Не оплачено'}</span></td>
                    <td><span class="status-badge ${attendanceClass}">${reg.attended ? 'Присутствовал' : 'Не отмечено'}</span></td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('myBookingsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

// ============================================
// ⭐ ОЦЕНКИ
// ============================================

async function loadMyRatings() {
    try {
        const querySnapshot = await db.collection('ratings')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const container = document.getElementById('ratingsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет оценок</p>';
            return;
        }
        
        const ratings = [];
        querySnapshot.forEach(doc => {
            const rating = doc.data();
            rating.id = doc.id;
            ratings.push(rating);
        });
        
        const trainingPromises = ratings.map(rating => 
            db.collection('trainings').doc(rating.trainingId).get()
        );
        
        const trainingSnapshots = await Promise.all(trainingPromises);
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Тренировка</th>
                        <th>Дата</th>
                        <th>Оценка</th>
                        <th>Комментарий</th>
                        <th>Тренер</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        ratings.forEach((rating, index) => {
            const training = trainingSnapshots[index].exists ? trainingSnapshots[index].data() : {};
            const date = rating.createdAt?.toDate() || new Date();
            const stars = '★'.repeat(rating.score) + '☆'.repeat(5 - rating.score);
            
            html += `
                <tr>
                    <td>${training.title || 'Неизвестно'}</td>
                    <td>${date.toLocaleDateString()}</td>
                    <td><span style="color: gold; font-size: 1.2em;">${stars}</span> (${rating.score}/5)</td>
                    <td>${rating.comment || 'Нет комментария'}</td>
                    <td>${rating.trainerName || 'Тренер'}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('ratingsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

// ============================================
// 👨‍🏫 ФУНКЦИИ ТРЕНЕРА
// ============================================

function openCreateTrainingModal() {
    if (userData.role !== 'trainer') return alert('Только тренер');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    
    document.getElementById('trainingDate').value = tomorrow.toISOString().slice(0, 16);
    openModal('createTrainingModal');
}

async function createTraining() {
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
}

async function openAttendanceModal() {
    console.log('Функция openAttendanceModal вызвана. Роль пользователя:', userData?.role);
    
    if (userData?.role !== 'trainer') {
        alert('❌ Только тренер может отмечать присутствие.');
        return;
    }

    try {
        console.log('Пытаюсь загрузить тренировки тренера...');
        
        // УПРОЩЕННЫЙ ЗАПРОС: Берем все тренировки тренера без сложных условий по дате
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .get(); // Убираем .limit(10) для надежности

        console.log('Запрос выполнен. Найдено тренировок:', trainingsSnapshot.size);

        const select = document.getElementById('attendanceTraining');
        if (!select) {
            console.error('Ошибка: Не найден элемент select с id="attendanceTraining"');
            alert('Внутренняя ошибка интерфейса. Элемент выбора тренировки не найден.');
            return;
        }
        
        select.innerHTML = '<option value="">Выберите тренировку для отметки</option>';

        if (trainingsSnapshot.empty) {
            console.log('У тренера нет созданных тренировок.');
            const option = document.createElement('option');
            option.textContent = 'У вас нет тренировок';
            option.disabled = true;
            select.appendChild(option);
            alert('⚠️ У вас еще нет созданных тренировок. Сначала создайте тренировку.');
            return;
        }

        // Преобразуем данные в массив и сортируем на клиенте (по убыванию даты)
        const trainingsList = [];
        trainingsSnapshot.forEach(doc => {
            trainingsList.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Сортировка по дате (сначала новые)
        trainingsList.sort((a, b) => b.date?.toDate() - a.date?.toDate());

        // Заполняем выпадающий список
        trainingsList.forEach(training => {
            const date = training.date?.toDate() ? training.date.toDate().toLocaleDateString('ru-RU') : 'Дата не указана';
            const option = document.createElement('option');
            option.value = training.id;
            option.textContent = `${training.title || 'Без названия'} (${date})`;
            // Можно добавить пометку для прошедших тренировок
            const now = new Date();
            if (training.date?.toDate() < now) {
                option.textContent += ' [Прошедшая]';
            }
            select.appendChild(option);
        });

        console.log('Выпадающий список тренировок заполнен.');

        // ОБНОВЛЕННЫЙ обработчик выбора тренировки
        select.onchange = async function() {
            const trainingId = this.value;
            console.log('Выбрана тренировка с ID:', trainingId);
            
            const usersDiv = document.getElementById('attendanceUsers');
            if (!usersDiv) {
                console.error('Ошибка: Не найден элемент div с id="attendanceUsers"');
                return;
            }
            
            if (!trainingId) {
                usersDiv.innerHTML = '<p style="color: #666; padding: 1rem; text-align: center;">Выберите тренировку из списка.</p>';
                return;
            }

            usersDiv.innerHTML = '<p style="color: #666; padding: 1rem; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Загрузка списка записавшихся...</p>';

            try {
                // Загружаем записи на выбранную тренировку
                const registrationsSnapshot = await db.collection('registrations')
                    .where('trainingId', '==', trainingId)
                    .get();

                console.log('На тренировку записано участников:', registrationsSnapshot.size);

                if (registrationsSnapshot.empty) {
                    usersDiv.innerHTML = '<p style="color: #dc3545; padding: 1rem; text-align: center;">На эту тренировку пока никто не записался.</p>';
                    return;
                }

                let html = '<h4 style="margin-bottom: 1rem;">Отметьте присутствующих:</h4>';
                const userPromises = [];
                const registrations = [];

                // Собираем данные о регистрациях и пользователях
                registrationsSnapshot.forEach(doc => {
                    const reg = doc.data();
                    reg.id = doc.id;
                    registrations.push(reg);
                    userPromises.push(db.collection('users').doc(reg.userId).get());
                });

                const userSnapshots = await Promise.all(userPromises);
                console.log('Данные пользователей загружены.');

                // Формируем список для отметки
                registrations.forEach((reg, index) => {
                    const userDoc = userSnapshots[index];
                    const user = userDoc?.exists ? userDoc.data() : {};
                    const userName = user.name || user.email || `Участник #${index+1}`;
                    const userEmail = user.email ? `(${user.email})` : '';
                    
                    // Проверяем, отмечено ли присутствие ранее
                    const isChecked = reg.attended === true;
                    const checkStatus = reg.attended ? ' (уже отмечен)' : '';

                    html += `
                        <div style="display: flex; align-items: center; gap: 12px; margin: 12px 0; padding: 12px; background: ${isChecked ? '#e8f5e9' : '#f8f9fa'}; border-radius: 10px; border-left: 4px solid ${isChecked ? '#28a745' : '#6c757d'};">
                            <input type="checkbox" 
                                   id="attend_${reg.id}" 
                                   ${isChecked ? 'checked disabled' : ''}
                                   data-registration="${reg.id}" 
                                   data-user="${reg.userId}"
                                   style="transform: scale(1.3); cursor: pointer;">
                            <label for="attend_${reg.id}" style="flex: 1; cursor: pointer;">
                                <div style="font-weight: 600;">${userName} ${userEmail}</div>
                                <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
                                    <span>Статус: ${reg.willAttend ? '✅ Подтвердил участие' : '❓ Не подтвердил'}</span>
                                    ${checkStatus ? `<span style="color: #28a745; margin-left: 10px;">${checkStatus}</span>` : ''}
                                </div>
                            </label>
                        </div>
                    `;
                });

                // Добавляем кнопку сохранения, если есть кого отмечать
                const hasUnmarked = registrations.some(reg => !reg.attended);
                if (hasUnmarked) {
                    html += `
                        <div style="margin-top: 20px; text-align: center;">
                            <button onclick="saveAttendance()" 
                                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                           color: white; 
                                           border: none; 
                                           padding: 12px 30px; 
                                           border-radius: 25px; 
                                           font-weight: 600; 
                                           cursor: pointer;">
                                <i class="fas fa-save"></i> Сохранить отметки присутствия
                            </button>
                        </div>
                    `;
                } else {
                    html += `<p style="color: #28a745; padding: 1rem; text-align: center; font-weight: 600;"><i class="fas fa-check-circle"></i> Все участники уже отмечены как присутствовавшие.</p>`;
                }

                usersDiv.innerHTML = html;
                console.log('Список участников для отметки отображен.');

            } catch (loadError) {
                console.error('Ошибка загрузки данных о записях:', loadError);
                usersDiv.innerHTML = `
                    <p style="color: #dc3545; padding: 1rem; text-align: center;">
                        <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки данных.
                    </p>
                    <p style="color: #666; font-size: 0.9em; text-align: center;">${loadError.message}</p>
                `;
            }
        };

        // Открываем модальное окно
        openModal('attendanceModal');
        console.log('Модальное окно "Отметить присутствие" открыто.');

    } catch (error) {
        console.error('Критическая ошибка в openAttendanceModal:', error);
        alert('❌ Не удалось загрузить список тренировок. Ошибка: ' + error.message);
    }
}
async function saveAttendance() {
    const trainingId = document.getElementById('attendanceTraining').value;
    if (!trainingId) return alert('Выберите тренировку');
    
    const checkboxes = document.querySelectorAll('#attendanceUsers input[type="checkbox"]');
    let updated = 0;
    
    try {
        for (const checkbox of checkboxes) {
            const registrationId = checkbox.dataset.registration;
            const attended = checkbox.checked;
            
            await db.collection('registrations').doc(registrationId).update({
                attended: attended,
                attendedAt: attended ? firebase.firestore.FieldValue.serverTimestamp() : null
            });
            
            updated++;
        }
        
        alert(`✅ Обновлено ${updated} записей`);
        closeModal('attendanceModal');
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

async function openAdjustBalanceModal() {
    if (userData.role !== 'trainer') return alert('Только тренер');
    
    try {
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'user')
            .limit(50)
            .get();
        
        const select = document.getElementById('balanceUser');
        select.innerHTML = '<option value="">Выберите пользователя</option>';
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${user.name || user.email} (Баланс: ${user.balance || 0})`;
            select.appendChild(option);
        });
        
        openModal('balanceModal');
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function saveBalanceAdjustment() {
    console.log('Функция saveBalanceAdjustment вызвана');
    
    // 1. БЕЗОПАСНОЕ получение элементов с проверкой
    const userSelect = document.getElementById('balanceUser');
    const amountInput = document.getElementById('balanceAmount');
    const reasonInput = document.getElementById('balanceReason');
    
    // Проверка, найдены ли элементы на странице
    if (!userSelect || !amountInput || !reasonInput) {
        console.error('Ошибка: Не найдены элементы формы!', { userSelect, amountInput, reasonInput });
        alert('❌ Внутренняя ошибка формы. Перезагрузите страницу.');
        return;
    }
    
    // 2. Получение значений
    const userId = userSelect.value;
    const amountText = amountInput.value;
    const reason = reasonInput.value.trim(); // Убираем лишние пробелы
    
    console.log('Полученные значения:', { userId, amountText, reason });
    
    // 3. ВАЛИДАЦИЯ (проверка корректности)
    if (!userId) {
        alert('❌ Выберите пользователя из списка');
        userSelect.focus(); // Курсор на поле с ошибкой
        return;
    }
    
    // Проверяем, что ввели число (дробные тоже можно)
    const amount = parseFloat(amountText);
    if (!amountText || isNaN(amount)) {
        alert('❌ Введите корректную сумму (число)');
        amountInput.focus();
        amountInput.select(); // Выделяем текст для удобства
        return;
    }
    
    if (!reason) {
        alert('❌ Укажите причину начисления или списания');
        reasonInput.focus();
        return;
    }
    
    // 4. Подтверждение действия
    const actionType = amount >= 0 ? 'начислить' : 'списать';
    const confirmMessage = `Подтвердите: ${actionType} ${Math.abs(amount)} баллов пользователю?`;
    
    if (!confirm(confirmMessage)) {
        return; // Пользователь отменил
    }
    
    // 5. СОХРАНЕНИЕ в базу данных (эта часть остаётся без изменений)
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) {
                throw new Error('Пользователь не найден в базе');
            }
            
            const currentBalance = userDoc.data().balance || 0;
            const newBalance = currentBalance + amount;
            
            // Обновляем баланс
            transaction.update(userRef, { balance: newBalance });
            
            // Создаём запись о транзакции
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
        
        // 6. УСПЕХ - Очищаем форму и показываем сообщение
        alert(`✅ Успешно! ${amount >= 0 ? 'Начислено' : 'Списано'} ${Math.abs(amount)} баллов`);
        
        // Очищаем поля формы
        userSelect.selectedIndex = 0; // Возвращаем на первый вариант
        amountInput.value = '';
        reasonInput.value = '';
        
        // Закрываем модальное окно
        closeModal('balanceModal');
        
        // Обновляем данные пользователя (если нужно)
        if (userData) {
            await loadUserData();
        }
        
    } catch (error) {
        console.error('Ошибка сохранения транзакции:', error);
        alert(`❌ Ошибка сохранения: ${error.message}`);
    }
}

async function openRateUsersModal() {
    if (userData.role !== 'trainer') return alert('Только тренер');
    
    try {
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .limit(10)
            .get();
        
        const select = document.getElementById('ratingTraining');
        select.innerHTML = '<option value="">Выберите тренировку</option>';
        
        trainingsSnapshot.forEach(doc => {
            const training = doc.data();
            const date = training.date.toDate();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${training.title} (${date.toLocaleDateString()})`;
            select.appendChild(option);
        });
        
        select.onchange = async function() {
            if (!this.value) return;
            
            const trainingId = this.value;
            const usersDiv = document.getElementById('ratingUsers');
            usersDiv.innerHTML = '<p>Загрузка...</p>';
            
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', trainingId)
                .where('attended', '==', true)
                .get();
            
            if (registrationsSnapshot.empty) {
                usersDiv.innerHTML = '<p>Нет участников</p>';
                return;
            }
            
            let html = '<h4>Участники для оценки:</h4>';
            
            const userPromises = [];
            const registrations = [];
            
            registrationsSnapshot.forEach(doc => {
                const reg = doc.data();
                reg.id = doc.id;
                registrations.push(reg);
                userPromises.push(db.collection('users').doc(reg.userId).get());
            });
            
            const userSnapshots = await Promise.all(userPromises);
            
            registrations.forEach((reg, index) => {
                const user = userSnapshots[index].exists ? userSnapshots[index].data() : {};
                
                html += `
                    <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                        <strong>${user.name || user.email || 'Неизвестный'}</strong>
                        
                        <div style="margin: 10px 0;">
                            <label>Оценка (1-5):</label>
                            <select id="score_${reg.userId}" style="margin-left: 10px; padding: 5px;">
                                <option value="1">1 ★</option>
                                <option value="2">2 ★★</option>
                                <option value="3" selected>3 ★★★</option>
                                <option value="4">4 ★★★★</option>
                                <option value="5">5 ★★★★★</option>
                            </select>
                        </div>
                        
                        <div>
                            <label>Комментарий:</label>
                            <textarea id="comment_${reg.userId}" 
                                      placeholder="Отзыв" 
                                      style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 5px; border: 1px solid #ddd;"></textarea>
                        </div>
                    </div>
                `;
            });
            
            usersDiv.innerHTML = html;
        };
        
        openModal('ratingsModal');
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function saveRatings() {
    const trainingId = document.getElementById('ratingTraining').value;
    if (!trainingId) return alert('Выберите тренировку');
    
    const trainingDoc = await db.collection('trainings').doc(trainingId).get();
    const training = trainingDoc.data();
    
    const registrationsSnapshot = await db.collection('registrations')
        .where('trainingId', '==', trainingId)
        .where('attended', '==', true)
        .get();
    
    let saved = 0;
    
    try {
        for (const doc of registrationsSnapshot.docs) {
            const reg = doc.data();
            const userId = reg.userId;
            
            const score = document.getElementById(`score_${userId}`)?.value;
            const comment = document.getElementById(`comment_${userId}`)?.value;
            
            if (score) {
                await db.collection('ratings').add({
                    userId: userId,
                    trainingId: trainingId,
                    score: parseInt(score),
                    comment: comment || '',
                    trainerId: currentUser.uid,
                    trainerName: userData.name,
                    trainingTitle: training.title,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                saved++;
            }
        }
        
        alert(`✅ Сохранено ${saved} оценок`);
        closeModal('ratingsModal');
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

async function loadTrainerStats() {
    if (userData.role !== 'trainer') return;
    
    try {
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .get();
        
        let totalParticipants = 0;
        let totalRevenue = 0;
        let upcomingTrainings = 0;
        let pastTrainings = 0;
        
        const now = firebase.firestore.Timestamp.now();
        
        for (const doc of trainingsSnapshot.docs) {
            const training = doc.data();
            const isPast = training.date.toDate() < now.toDate();
            
            if (isPast) pastTrainings++;
            else upcomingTrainings++;
            
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', doc.id)
                .get();
            
            totalParticipants += registrationsSnapshot.size;
            
            registrationsSnapshot.forEach(regDoc => {
                if (regDoc.data().charged) {
                    totalRevenue += training.price || 0;
                }
            });
        }
        
        const statsDiv = document.getElementById('trainerStats');
        statsDiv.innerHTML = `
            <h3><i class="fas fa-chart-line"></i> Статистика</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${trainingsSnapshot.size}</div>
                    <div>Всего тренировок</div>
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">${upcomingTrainings}</div>
                    <div>Предстоящих</div>
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #388e3c;">${pastTrainings}</div>
                    <div>Проведенных</div>
                </div>
                <div style="background: #fff3e0; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${totalParticipants}</div>
                    <div>Участников всего</div>
                </div>
                <div style="background: #fce4ec; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #c2185b;">${totalRevenue}</div>
                    <div>Всего баллов списано</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// ============================================
// ✏️ РЕДАКТИРОВАНИЕ ТРЕНИРОВОК
// ============================================

async function openManageTrainingsModal() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может управлять тренировками');
        return;
    }
    
    try {
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .limit(20)
            .get();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        let html = `
            <div class="modal" style="background: white; padding: 20px; border-radius: 15px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3><i class="fas fa-edit"></i> Управление тренировками</h3>
        `;
        
        if (trainingsSnapshot.empty) {
            html += '<p>У вас нет тренировок</p>';
        } else {
            html += `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 10px; text-align: left;">Название</th>
                            <th style="padding: 10px; text-align: left;">Дата</th>
                            <th style="padding: 10px; text-align: left;">Цена</th>
                            <th style="padding: 10px; text-align: left;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            trainingsSnapshot.forEach(doc => {
                const training = doc.data();
                const date = training.date.toDate();
                
                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">${training.title}</td>
                        <td style="padding: 10px;">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td style="padding: 10px;">${training.price || 0} баллов</td>
                        <td style="padding: 10px;">
                            <button onclick="editTraining('${doc.id}')" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 5px; margin-right: 5px; cursor: pointer;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteTraining('${doc.id}')" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
        }
        
        html += `
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 10px;
                        cursor: pointer;
                    ">Закрыть</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = html;
        document.body.appendChild(modal);
        
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function editTraining(trainingId) {
    if (userData.role !== 'trainer') {
        alert('Только тренер может редактировать тренировки');
        return;
    }
    
    try {
        const trainingDoc = await db.collection('trainings').doc(trainingId).get();
        if (!trainingDoc.exists) {
            alert('Тренировка не найдена');
            return;
        }
        
        const training = trainingDoc.data();
        const date = training.date.toDate();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const formattedDate = date.toISOString().slice(0, 16);
        
        modal.innerHTML = `
            <div class="modal" style="background: white; padding: 20px; border-radius: 15px; max-width: 500px; width: 90%;">
                <h3><i class="fas fa-edit"></i> Редактировать тренировку</h3>
                
                <div style="margin-top: 15px;">
                    <label>Название:</label>
                    <input type="text" id="editTrainingTitle" value="${training.title || ''}" 
                           style="width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                
                <div style="margin-top: 10px;">
                    <label>Дата и время:</label>
                    <input type="datetime-local" id="editTrainingDate" value="${formattedDate}" 
                           style="width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                
                <div style="margin-top: 10px;">
                    <label>Стоимость (баллы):</label>
                    <input type="number" id="editTrainingPrice" value="${training.price || 0}" 
                           style="width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                
                <div style="margin-top: 10px;">
                    <label>Максимум участников:</label>
                    <input type="number" id="editTrainingMax" value="${training.maxParticipants || ''}" 
                           style="width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                
                <div style="margin-top: 10px;">
                    <label>Описание:</label>
                    <textarea id="editTrainingDesc" 
                              style="width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px; height: 100px;">${training.description || ''}</textarea>
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button onclick="saveTrainingEdit('${trainingId}')" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        flex: 1;
                        cursor: pointer;
                    ">
                        <i class="fas fa-save"></i> Сохранить
                    </button>
                    
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        flex: 1;
                        cursor: pointer;
                    ">
                        Отмена
                    </button>
                    
                    <button onclick="deleteTraining('${trainingId}')" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function saveTrainingEdit(trainingId) {
    const title = document.getElementById('editTrainingTitle').value;
    const date = document.getElementById('editTrainingDate').value;
    const price = document.getElementById('editTrainingPrice').value;
    const max = document.getElementById('editTrainingMax').value;
    const desc = document.getElementById('editTrainingDesc').value;
    
    if (!title || !date || !price) {
        alert('Заполните обязательные поля');
        return;
    }
    
    try {
        await db.collection('trainings').doc(trainingId).update({
            title: title,
            date: firebase.firestore.Timestamp.fromDate(new Date(date)),
            price: parseInt(price),
            maxParticipants: max ? parseInt(max) : null,
            description: desc || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('✅ Тренировка обновлена!');
        
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        
        loadTrainings();
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

async function deleteTraining(trainingId) {
    if (!confirm('Удалить эту тренировку?')) return;
    
    try {
        const registrationsSnapshot = await db.collection('registrations')
            .where('trainingId', '==', trainingId)
            .get();
        
        if (!registrationsSnapshot.empty) {
            if (!confirm(`На эту тренировку записано ${registrationsSnapshot.size} человек. Все равно удалить?`)) {
                return;
            }
        }
        
        await db.collection('trainings').doc(trainingId).delete();
        
        const batch = db.batch();
        registrationsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        alert('✅ Тренировка удалена!');
        
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
        
        loadTrainings();
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

// ============================================
// 📋 ЗАПИСЬ НА ТРЕНИРОВКИ
// ============================================

function openRegisterModal(trainingId, price, title) {
    selectedTrainingId = trainingId;
    selectedTrainingPrice = price;
    
    document.getElementById('registerTrainingTitle').textContent = title;
    document.getElementById('registerTrainingPrice').textContent = price;
    document.getElementById('registerUserBalance').textContent = userData.balance;
    
    openModal('registerModal');
}

async function confirmRegistration() {
    if (!selectedTrainingId || !userData) return;
    
    if (userData.balance < selectedTrainingPrice) {
        alert(`❌ Недостаточно баллов! Нужно: ${selectedTrainingPrice}, у вас: ${userData.balance}`);
        closeModal('registerModal');
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(currentUser.uid);
            const userDoc = await transaction.get(userRef);
            const currentBalance = userDoc.data().balance;
            
            if (currentBalance < selectedTrainingPrice) {
                throw new Error('Недостаточно баллов');
            }
            
            const registrationsQuery = await db.collection('registrations')
                .where('userId', '==', currentUser.uid)
                .where('trainingId', '==', selectedTrainingId)
                .get();
            
            if (!registrationsQuery.empty) {
                throw new Error('Вы уже записаны');
            }
            
            const trainingRef = db.collection('trainings').doc(selectedTrainingId);
            const trainingDoc = await transaction.get(trainingRef);
            const training = trainingDoc.data();
            
            const participantsQuery = await db.collection('registrations')
                .where('trainingId', '==', selectedTrainingId)
                .get();
            
            if (training.maxParticipants && participantsQuery.size >= training.maxParticipants) {
                throw new Error('Нет свободных мест');
            }
            
            transaction.update(userRef, {
                balance: currentBalance - selectedTrainingPrice
            });
            
            const regRef = db.collection('registrations').doc();
            transaction.set(regRef, {
                userId: currentUser.uid,
                trainingId: selectedTrainingId,
                willAttend: true,
                attended: false,
                charged: true,
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            const transRef = db.collection('transactions').doc();
            transaction.set(transRef, {
                userId: currentUser.uid,
                trainingId: selectedTrainingId,
                amount: selectedTrainingPrice,
                type: 'debit',
                description: `Запись: ${training.title}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        alert('✅ Вы записаны!');
        closeModal('registerModal');
        
        loadUserData();
        loadTrainings();
        if (document.getElementById('myBookingsScreen').classList.contains('active')) {
            loadMyBookings();
        }
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
        closeModal('registerModal');
    }
}

// ============================================
// 🎯 ИНИЦИАЛИЗАЦИЯ
// ============================================

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        
        document.getElementById('loginScreen').classList.remove('active');
        showScreen('schedule');
    } else {
        currentUser = null;
        userData = null;
        
        document.getElementById('loginScreen').classList.add('active');
        document.querySelectorAll('.screen:not(#loginScreen)').forEach(screen => {
            screen.classList.remove('active');
        });
        document.querySelector('.bottom-nav').style.display = 'none';
        
        document.getElementById('logoutBtn').classList.add('hidden');
        document.getElementById('userName').textContent = 'Гость';
    }
});

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
// ============================================
// 🔄 ФУНКЦИИ ОТМЕНЫ ЗАНЯТИЙ И ВОЗВРАТА БАЛЛОВ
// ============================================

// ОТМЕНИТЬ ТРЕНИРОВКУ И ВЕРНУТЬ БАЛЛЫ
async function cancelTraining(trainingId) {
    if (userData.role !== 'trainer') {
        alert('Только тренер может отменять тренировки');
        return;
    }
    
    if (!confirm('Отменить тренировку и вернуть баллы всем записавшимся?')) {
        return;
    }
    
    try {
        // Получаем тренировку
        const trainingDoc = await db.collection('trainings').doc(trainingId).get();
        if (!trainingDoc.exists) {
            alert('Тренировка не найдена');
            return;
        }
        
        const training = trainingDoc.data();
        
        // Получаем всех записавшихся
        const registrationsSnapshot = await db.collection('registrations')
            .where('trainingId', '==', trainingId)
            .get();
        
        if (registrationsSnapshot.empty) {
            alert('На тренировку никто не записан');
            return;
        }
        
        let refundedCount = 0;
        
        // Возвращаем баллы каждому участнику
        for (const doc of registrationsSnapshot.docs) {
            const registration = doc.data();
            
            // Проверяем, были ли списаны баллы
            if (registration.charged) {
                await db.runTransaction(async (transaction) => {
                    // Получаем пользователя
                    const userRef = db.collection('users').doc(registration.userId);
                    const userDoc = await transaction.get(userRef);
                    
                    if (userDoc.exists) {
                        const currentBalance = userDoc.data().balance;
                        const newBalance = currentBalance + (training.price || 0);
                        
                        // Возвращаем баллы
                        transaction.update(userRef, {
                            balance: newBalance
                        });
                        
                        // Создаем транзакцию возврата
                        const transRef = db.collection('transactions').doc();
                        transaction.set(transRef, {
                            userId: registration.userId,
                            trainingId: trainingId,
                            amount: training.price || 0,
                            type: 'credit',
                            description: `Возврат за отмененную тренировку: ${training.title}`,
                            createdBy: currentUser.uid,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // Помечаем регистрацию как отмененную
                        transaction.update(doc.ref, {
                            cancelled: true,
                            refunded: true,
                            cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        refundedCount++;
                    }
                });
            }
        }
        
        // Помечаем тренировку как отмененную
        await db.collection('trainings').doc(trainingId).update({
            cancelled: true,
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
            cancelledBy: currentUser.uid
        });
        
        alert(`✅ Тренировка отменена! Возвращено баллов ${refundedCount} участникам.`);
        
        // Обновляем интерфейс
        loadTrainings();
        
    } catch (error) {
        alert('❌ Ошибка отмены тренировки: ' + error.message);
    }
}

// ОТМЕНА ЗАПИСИ ПОЛЬЗОВАТЕЛЕМ (С ВОЗВРАТОМ)
async function cancelUserRegistration(registrationId, trainingId) {
    if (!confirm('Отменить запись и вернуть баллы?')) {
        return;
    }
    
    try {
        // Получаем данные о регистрации и тренировке
        const registrationDoc = await db.collection('registrations').doc(registrationId).get();
        const trainingDoc = await db.collection('trainings').doc(trainingId).get();
        
        if (!registrationDoc.exists || !trainingDoc.exists) {
            alert('Запись не найдена');
            return;
        }
        
        const registration = registrationDoc.data();
        const training = trainingDoc.data();
        
        // Проверяем, что это запись текущего пользователя
        if (registration.userId !== currentUser.uid) {
            alert('Вы можете отменять только свои записи');
            return;
        }
        
        // Проверяем, можно ли отменить (не раньше чем за 2 часа до тренировки)
        const trainingDate = training.date.toDate();
        const now = new Date();
        const hoursBefore = (trainingDate - now) / (1000 * 60 * 60);
        
        if (hoursBefore < 2) {
            alert('Отмена возможна не позднее чем за 2 часа до тренировки');
            return;
        }
        
        // Проверяем, не было ли уже присутствия
        if (registration.attended) {
            alert('Нельзя отменить посещенную тренировку');
            return;
        }
        
        // Возвращаем баллы
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(currentUser.uid);
            const userDoc = await transaction.get(userRef);
            
            if (userDoc.exists) {
                const currentBalance = userDoc.data().balance;
                const newBalance = currentBalance + (training.price || 0);
                
                // Возвращаем баллы
                transaction.update(userRef, {
                    balance: newBalance
                });
                
                // Создаем транзакцию возврата
                const transRef = db.collection('transactions').doc();
                transaction.set(transRef, {
                    userId: currentUser.uid,
                    trainingId: trainingId,
                    amount: training.price || 0,
                    type: 'credit',
                    description: `Возврат за отмену записи: ${training.title}`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Помечаем регистрацию как отмененную
                transaction.update(registrationDoc.ref, {
                    cancelled: true,
                    refunded: true,
                    cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        
        alert('✅ Запись отменена! Баллы возвращены на ваш счет.');
        
        // Обновляем интерфейс
        loadUserData();
        loadMyBookings();
        
    } catch (error) {
        alert('❌ Ошибка отмены записи: ' + error.message);
    }
}

// ============================================
// 📊 ЭКСПОРТ В EXCEL ДЛЯ ТРЕНЕРА
// ============================================

// ВЫГРУЗКА ДАННЫХ ПО ПОСЕЩЕНИЯМ
async function exportAttendanceToExcel() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может выгружать данные');
        return;
    }
    
    try {
        // Получаем все тренировки тренера
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .get();
        
        if (trainingsSnapshot.empty) {
            alert('У вас нет тренировок');
            return;
        }
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Заголовки для CSV
        csvContent += "Тренировка;Дата;Цена;Участник;Email;Посещение;Оплачено;Баллы списано;Оценка;Комментарий\r\n";
        
        let totalRows = 0;
        
        // Собираем данные по каждой тренировке
        for (const trainingDoc of trainingsSnapshot.docs) {
            const training = trainingDoc.data();
            const trainingDate = training.date.toDate();
            
            // Получаем записи на эту тренировку
            const registrationsSnapshot = await db.collection('registrations')
                .where('trainingId', '==', trainingDoc.id)
                .get();
            
            // Получаем оценки для этой тренировки
            const ratingsSnapshot = await db.collection('ratings')
                .where('trainingId', '==', trainingDoc.id)
                .get();
            
            const ratings = {};
            ratingsSnapshot.forEach(doc => {
                const rating = doc.data();
                ratings[rating.userId] = rating;
            });
            
            // Обрабатываем каждую регистрацию
            for (const regDoc of registrationsSnapshot.docs) {
                const registration = regDoc.data();
                
                // Получаем данные пользователя
                const userDoc = await db.collection('users').doc(registration.userId).get();
                const user = userDoc.exists ? userDoc.data() : {};
                
                // Получаем оценку пользователя
                const userRating = ratings[registration.userId];
                
                // Формируем строку данных
                const row = [
                    `"${training.title || ''}"`,
                    trainingDate.toLocaleDateString(),
                    training.price || 0,
                    `"${user.name || user.email || 'Неизвестный'}"`,
                    user.email || '',
                    registration.attended ? 'Да' : 'Нет',
                    registration.charged ? 'Да' : 'Нет',
                    registration.charged ? training.price || 0 : 0,
                    userRating ? userRating.score : '',
                    userRating ? `"${userRating.comment || ''}"` : ''
                ].join(';');
                
                csvContent += row + "\r\n";
                totalRows++;
            }
        }
        
        if (totalRows === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        // Создаем и скачиваем файл
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attendance_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`✅ Данные экспортированы! Строк: ${totalRows}`);
        
    } catch (error) {
        alert('❌ Ошибка экспорта: ' + error.message);
    }
}

// ВЫГРУЗКА ФИНАНСОВЫХ ДАННЫХ
async function exportFinancialToExcel() {
    if (userData.role !== 'trainer') {
        alert('Только тренер может выгружать финансовые данные');
        return;
    }
    
    try {
        // Получаем всех пользователей
        const usersSnapshot = await db.collection('users').get();
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Пользователь;Email;Текущий баланс;Всего начислено;Всего списано;Кол-во посещений;Сумма посещений\r\n";
        
        let totalRows = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            
            // Получаем транзакции пользователя
            const transactionsSnapshot = await db.collection('transactions')
                .where('userId', '==', userDoc.id)
                .get();
            
            let totalCredit = 0;
            let totalDebit = 0;
            
            transactionsSnapshot.forEach(doc => {
                const trans = doc.data();
                if (trans.type === 'credit') {
                    totalCredit += trans.amount;
                } else if (trans.type === 'debit') {
                    totalDebit += trans.amount;
                }
            });
            
            // Получаем посещения пользователя
            const registrationsSnapshot = await db.collection('registrations')
                .where('userId', '==', userDoc.id)
                .where('attended', '==', true)
                .get();
            
            let attendanceSum = 0;
            
            for (const regDoc of registrationsSnapshot.docs) {
                const registration = regDoc.data();
                const trainingDoc = await db.collection('trainings').doc(registration.trainingId).get();
                
                if (trainingDoc.exists) {
                    const training = trainingDoc.data();
                    attendanceSum += training.price || 0;
                }
            }
            
            // Формируем строку
            const row = [
                `"${user.name || user.email || 'Неизвестный'}"`,
                user.email || '',
                user.balance || 0,
                totalCredit,
                totalDebit,
                registrationsSnapshot.size,
                attendanceSum
            ].join(';');
            
            csvContent += row + "\r\n";
            totalRows++;
        }
        
        if (totalRows === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        // Скачиваем файл
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `financial_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`✅ Финансовые данные экспортированы! Пользователей: ${totalRows}`);
        
    } catch (error) {
        alert('❌ Ошибка экспорта: ' + error.message);
    }
}

// ============================================
// 🎨 ОБНОВЛЕННЫЙ ИНТЕРФЕЙС ДЛЯ ОТМЕНЫ
// ============================================

// Дополните функцию loadTrainings() - добавьте кнопку отмены для тренера:
// В карточке тренировки для тренера добавьте:

async function loadTrainings() {
    try {
        const querySnapshot = await db.collection('trainings')
            .where('date', '>=', firebase.firestore.Timestamp.now())
            .orderBy('date')
            .limit(20)
            .get();
        
        const container = document.getElementById('trainingsList');
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">Нет тренировок</p>';
            return;
        }
        
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
                            ${isCancelled ? '' : `
                                <button onclick="viewTrainingDetails('${doc.id}')" class="btn-secondary" style="flex: 1;">
                                    <i class="fas fa-info-circle"></i> Подробнее
                                </button>
                            `}
                        </div>
                    `}
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('trainingsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

// ============================================
// 📋 ОБНОВЛЕННЫЙ ИНТЕРФЕЙС МОИХ ЗАПИСЕЙ
// ============================================

// Обновите функцию loadMyBookings() - добавьте кнопку отмены для пользователя:

async function loadMyBookings() {
    try {
        const querySnapshot = await db.collection('registrations')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const container = document.getElementById('myBookingsList');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p class="text-center">У вас нет записей на тренировки</p>';
            return;
        }
        
        const registrations = [];
        querySnapshot.forEach(doc => {
            const reg = doc.data();
            reg.id = doc.id;
            registrations.push(reg);
        });
        
        const trainingPromises = registrations.map(reg => 
            db.collection('trainings').doc(reg.trainingId).get()
        );
        
        const trainingSnapshots = await Promise.all(trainingPromises);
        
        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 12px; text-align: left;">Тренировка</th>
                        <th style="padding: 12px; text-align: left;">Дата</th>
                        <th style="padding: 12px; text-align: left;">Статус</th>
                        <th style="padding: 12px; text-align: left;">Действия</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        registrations.forEach((reg, index) => {
            const training = trainingSnapshots[index].exists ? trainingSnapshots[index].data() : {};
            const date = training.date?.toDate() || new Date();
            const isTrainingCancelled = training.cancelled;
            const isRegistrationCancelled = reg.cancelled;
            
            // Определяем статус
            let status = '';
            let statusColor = '';
            
            if (isTrainingCancelled) {
                status = 'Тренировка отменена';
                statusColor = '#dc3545';
            } else if (isRegistrationCancelled) {
                status = 'Вы отменили запись';
                statusColor = '#ffc107';
            } else if (reg.attended) {
                status = 'Посещено';
                statusColor = '#28a745';
            } else if (reg.charged) {
                status = 'Записан';
                statusColor = '#17a2b8';
            } else {
                status = 'Ожидание';
                statusColor = '#6c757d';
            }
            
            // Определяем доступные действия
            let actions = '';
            const now = new Date();
            const trainingDate = training.date?.toDate() || new Date();
            const hoursBefore = (trainingDate - now) / (1000 * 60 * 60);
            const canCancel = !isTrainingCancelled && !isRegistrationCancelled && !reg.attended && hoursBefore >= 2;
            
            if (canCancel) {
                actions = `
                    <button onclick="cancelUserRegistration('${reg.id}', '${reg.trainingId}')" 
                            style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-ban"></i> Отменить
                    </button>
                `;
            } else if (isTrainingCancelled && reg.charged && !reg.refunded) {
                actions = `
                    <button onclick="requestRefund('${reg.id}', '${reg.trainingId}')" 
                            style="background: #ffc107; color: black; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-coins"></i> Запросить возврат
                    </button>
                `;
            } else {
                actions = '<span style="color: #6c757d;">-</span>';
            }
            
            html += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        <div><strong>${training.title || 'Неизвестно'}</strong></div>
                        <div style="font-size: 0.9em; color: #666;">${training.price || 0} баллов</div>
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        ${date.toLocaleDateString()}<br>
                        <small>${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        <span style="padding: 4px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 600; background: ${statusColor}; color: white;">
                            ${status}
                        </span>
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        ${actions}
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('myBookingsList').innerHTML = '<p class="text-center">Ошибка загрузки</p>';
    }
}

// ============================================
// 📥 ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// ЗАПРОС ВОЗВРАТА (для пользователя)
async function requestRefund(registrationId, trainingId) {
    if (!confirm('Отправить запрос на возврат баллов тренеру?')) {
        return;
    }
    
    try {
        // Создаем уведомление для тренера
        const notificationRef = db.collection('notifications').doc();
        await notificationRef.set({
            type: 'refund_request',
            userId: currentUser.uid,
            registrationId: registrationId,
            trainingId: trainingId,
            message: 'Пользователь запросил возврат баллов за отмененную тренировку',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        alert('✅ Запрос на возврат отправлен тренеру');
        
    } catch (error) {
        alert('❌ Ошибка отправки запроса: ' + error.message);
    }
}

// ПРОСМОТР ДЕТАЛЕЙ ТРЕНИРОВКИ
async function viewTrainingDetails(trainingId) {
    try {
        const trainingDoc = await db.collection('trainings').doc(trainingId).get();
        if (!trainingDoc.exists) {
            alert('Тренировка не найдена');
            return;
        }
        
        const training = trainingDoc.data();
        const date = training.date.toDate();
        
        // Получаем количество записавшихся
        const registrationsSnapshot = await db.collection('registrations')
            .where('trainingId', '==', trainingId)
            .get();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div class="modal" style="background: white; padding: 20px; border-radius: 15px; max-width: 500px; width: 90%;">
                <h3><i class="fas fa-info-circle"></i> Детали тренировки</h3>
                
                <div style="margin-top: 15px;">
                    <h4>${training.title || 'Без названия'}</h4>
                    <p><strong>Дата:</strong> ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p><strong>Стоимость:</strong> ${training.price || 0} баллов</p>
                    <p><strong>Максимум участников:</strong> ${training.maxParticipants || 'Не ограничено'}</p>
                    <p><strong>Записано:</strong> ${registrationsSnapshot.size} человек</p>
                    <p><strong>Тренер:</strong> ${training.trainerName || 'Не указан'}</p>
                </div>
                
                ${training.description ? `
                    <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                        <strong>Описание:</strong>
                        <p>${training.description}</p>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        alert('Ошибка загрузки деталей: ' + error.message);
    }
}

// ============================================
// 📊 ДОПОЛНИТЕЛЬНЫЕ КНОПКИ ДЛЯ ТРЕНЕРА
// ============================================

// Добавьте в панель тренера новые кнопки экспорта:

async function loadTrainerStats() {
    if (userData.role !== 'trainer') return;
    
    try {
        const trainingsSnapshot = await db.collection('trainings')
            .where('trainerId', '==', currentUser.uid)
            .get();
        
        let totalParticipants = 0;
        let totalRevenue = 0;
        let upcomingTrainings = 0;
        let pastTrainings = 0;
        let cancelledTrainings = 0;
        
        const now = firebase.firestore.Timestamp.now();
        
        for (const doc of trainingsSnapshot.docs) {
            const training = doc.data();
            const isPast = training.date.toDate() < now.toDate();
            const isCancelled = training.cancelled;
            
            if (isCancelled) {
                cancelledTrainings++;
            } else if (isPast) {
                pastTrainings++;
            } else {
                upcomingTrainings++;
            }
            
            if (!isCancelled) {
                const registrationsSnapshot = await db.collection('registrations')
                    .where('trainingId', '==', doc.id)
                    .get();
                
                totalParticipants += registrationsSnapshot.size;
                
                registrationsSnapshot.forEach(regDoc => {
                    if (regDoc.data().charged) {
                        totalRevenue += training.price || 0;
                    }
                });
            }
        }
        
        const statsDiv = document.getElementById('trainerStats');
        statsDiv.innerHTML = `
            <h3><i class="fas fa-chart-line"></i> Статистика</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${trainingsSnapshot.size}</div>
                    <div>Всего тренировок</div>
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">${upcomingTrainings}</div>
                    <div>Предстоящих</div>
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #388e3c;">${pastTrainings}</div>
                    <div>Проведенных</div>
                </div>
                <div style="background: #fff3e0; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${totalParticipants}</div>
                    <div>Участников</div>
                </div>
                <div style="background: #fce4ec; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #c2185b;">${totalRevenue}</div>
                    <div>Баллов списано</div>
                </div>
                <div style="background: #f8d7da; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #721c24;">${cancelledTrainings}</div>
                    <div>Отменено</div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h4><i class="fas fa-file-export"></i> Экспорт данных</h4>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick="exportAttendanceToExcel()" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-users"></i> Посещения (CSV)
                    </button>
                    
                    <button onclick="exportFinancialToExcel()" style="
                        background: #17a2b8;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-coins"></i> Финансы (CSV)
                    </button>
                </div>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    <i class="fas fa-info-circle"></i> Файлы CSV можно открыть в Excel
                </p>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка:', error);
    }
}
// ============================================
// 🌐 ГЛОБАЛЬНЫЙ ЭКСПОРТ ВСЕХ ФУНКЦИЙ
// ============================================

window.showScreen = showScreen;
window.openModal = openModal;
window.closeModal = closeModal;
window.register = register;
window.login = login;
window.logout = logout;
window.refreshSchedule = refreshSchedule;
window.openCreateTrainingModal = openCreateTrainingModal;
window.createTraining = createTraining;
window.openAttendanceModal = openAttendanceModal;
window.saveAttendance = saveAttendance;
window.openAdjustBalanceModal = openAdjustBalanceModal;
window.saveBalanceAdjustment = saveBalanceAdjustment;
window.openRateUsersModal = openRateUsersModal;
window.saveRatings = saveRatings;
window.openManageTrainingsModal = openManageTrainingsModal;
window.editTraining = editTraining;
window.saveTrainingEdit = saveTrainingEdit;
window.deleteTraining = deleteTraining;
window.openRegisterModal = openRegisterModal;
window.confirmRegistration = confirmRegistration;

// Новые функции
window.cancelTraining = cancelTraining;
window.cancelUserRegistration = cancelUserRegistration;
window.exportAttendanceToExcel = exportAttendanceToExcel;
window.exportFinancialToExcel = exportFinancialToExcel;
window.viewTrainingDetails = viewTrainingDetails;
window.requestRefund = requestRefund;
