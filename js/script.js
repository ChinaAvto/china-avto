// В самом начале скрипта, после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем язык
    switchLanguage('kz');
    
    // Загружаем автомобили
    loadCars();
    
    // Проверяем избранное
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
        favorites = JSON.parse(savedFavorites);
    }
    
    // Применяем текущий язык к полям ввода
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    if (currentLanguage === 'ru') {
        yearFrom.setAttribute('placeholder', 'От');
        yearTo.setAttribute('placeholder', 'До');
    } else {
        yearFrom.setAttribute('placeholder', 'Бастап');
        yearTo.setAttribute('placeholder', 'Дейін');
    }
});

// Обновим функцию toggleFavorite для сохранения в localStorage
function toggleFavorite(carId, event) {
    event.stopPropagation();
    
    if (favorites.includes(carId)) {
        favorites = favorites.filter(id => id !== carId);
    } else {
        favorites.push(carId);
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    renderCars();
    renderFavorites();
}

// Заменим статический массив carsData на загрузку из Firestore
let carsData = [];
let favorites = [];
let filteredCars = [];

// Функция загрузки автомобилей из Firestore
async function loadCars() {
    const grid = document.getElementById('carsGrid');
    grid.innerHTML = '<div class="loading" data-ru="Загрузка автомобилей..." data-kz="Автокөліктер жүктелуде...">Загрузка автомобилей...</div>';

    try {
        const querySnapshot = await db.collection("cars").get();
        if (querySnapshot.empty) {
            console.warn("No cars found in Firestore");
            return;
        }
        
        carsData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                // Основная информация
                brand: data.brand || null,
                model: data.model || null,
                name: data.name || null,
                year: data.year || null,
                price: data.price || null,
                averagePrice: data.averagePrice || null,
                address: data.address || null,
                color: data.color || null,
                
                // Технические характеристики
                transmission: data.transmission || null,
                engineType: data.engineType || null,
                engine: data.engine || null,
                torque: data.torque || null,
                power: data.power || null,
                maxSpeed: data.maxSpeed || null,
                acceleration: data.acceleration || null,
                dimensions: data.dimensions || null,
                tireSize: data.tireSize || null,
                
                // Изображения и дата
                images: data.images || [],
                createdAt: data.createdAt?.toDate() || null
            };
        });
        
        // Собираем уникальные бренды и модели
        brandsAndModels = {};
        carsData.forEach(car => {
            if (car.brand) {
                if (!brandsAndModels[car.brand]) {
                    brandsAndModels[car.brand] = new Set();
                }
                if (car.model) {
                    brandsAndModels[car.brand].add(car.model);
                }
            }
        });
        
        // Обновляем фильтры
        updateBrandFilter();
        updateModelFilter();
        
        filteredCars = [...carsData];
        renderCars();
    } catch (error) {
        console.error("Ошибка загрузки автомобилей:", error);
        document.getElementById('carsGrid').innerHTML = `
            <div class="error-message">
                <p data-ru="Не удалось загрузить данные об автомобилях. Пожалуйста, попробуйте позже." 
                   data-kz="Автокөліктер туралы деректерді жүктеу мүмкін болмады. Кейінірек қайталап көріңіз.">
                   Не удалось загрузить данные об автомобилях. Пожалуйста, попробуйте позже.
                </p>
                <button onclick="loadCars()" data-ru="Попробовать снова" data-kz="Қайтадан көру">Попробовать снова</button>
            </div>
        `;
        switchLanguage(currentLanguage);
    }
}

function updateBrandFilter() {
    const brandFilter = document.getElementById('brandFilter');
    // Сохраняем текущее значение
    const currentValue = brandFilter.value;
    
    // Очищаем и добавляем только "Все марки"
    brandFilter.innerHTML = '<option value="" data-ru="Все марки" data-kz="Барлық маркалар">Все марки</option>';
    
    // Добавляем бренды из Firebase
    Object.keys(brandsAndModels).sort().forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandFilter.appendChild(option);
    });
    
    // Восстанавливаем выбранное значение, если оно есть
    if (currentValue && Array.from(brandFilter.options).some(opt => opt.value === currentValue)) {
        brandFilter.value = currentValue;
    }
}

// Функция сохранения автомобиля
async function saveCar(carData, imageFile) {
    try {
        let imageUrl = '';
        
        // Если есть файл изображения, загружаем его в Storage
        if (imageFile) {
            const storageRef = storage.ref(`car_images/${Date.now()}_${imageFile.name}`);
            const uploadTask = await storageRef.put(imageFile);
            imageUrl = await uploadTask.ref.getDownloadURL();
        }
        
        // Добавляем данные в Firestore
        const carRef = await db.collection("cars").add({
            ...carData,
            imageUrl: imageUrl || 'https://via.placeholder.com/300',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return carRef.id;
    } catch (error) {
        console.error("Ошибка сохранения автомобиля:", error);
        throw error;
    }
}

// Функция сохранения заявки
async function saveApplication(carId, applicationData) {
    try {
        await db.collection("applications").add({
            carId: carId,
            name: applicationData.name,
            phone: applicationData.phone,
            carName: applicationData.carName, // Добавляем название машины
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Ошибка сохранения заявки:", error);
        throw error;
    }
}

function showApplicationForm(carId, carName) {
    const modal = document.getElementById('applicationModal');
    modal.setAttribute('data-car-id', carId);
    modal.setAttribute('data-car-name', carName);
    modal.style.display = 'block';
}

// Обновленный обработчик формы заявки
document.getElementById('applicationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('applicantName').value;
    const phone = document.getElementById('applicantPhone').value;
    const carId = document.getElementById('applicationModal').getAttribute('data-car-id');
    const carName = document.getElementById('applicationModal').getAttribute('data-car-name') || 'Неизвестная модель';
    
    if (!carId) {
        alert(currentLanguage === 'kz' 
            ? 'Қате: автокөлік ID табылмады. Қайталап көріңіз.' 
            : 'Ошибка: не найден ID автомобиля. Пожалуйста, попробуйте еще раз.');
        return;
    }
    
    try {
        await saveApplication(carId, {
            name: name,
            phone: phone,
            carName: carName
        });
        
        alert(currentLanguage === 'kz' 
            ? 'Өтінім сәтті жіберілді! Жуық арада сізбен хабарласамыз.' 
            : 'Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.');
        
        closeModal();
        this.reset();
    } catch (error) {
        console.error('Error submitting application:', error);
        alert(currentLanguage === 'kz' 
            ? 'Қате орын алды. Өтінімді қайта жіберіңіз.' 
            : 'Произошла ошибка. Пожалуйста, попробуйте отправить заявку еще раз.');
    }
});

let currentLanguage = 'kz';

let brandsAndModels = {};

function switchLanguage(lang) {
    // Переключение активной кнопки языка
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if ((lang === 'ru' && btn.textContent === 'Русский') || 
            (lang === 'kz' && btn.textContent === 'Қазақша')) {
            btn.classList.add('active');
        }
    });

    // Обновление текстовых элементов
    document.querySelectorAll('[data-ru], [data-kz], [placeholder-ru], [placeholder-kz]').forEach(element => {
        if (lang === 'ru') {
            if (element.hasAttribute('data-ru')) {
                element.textContent = element.getAttribute('data-ru');
            }
            if (element.hasAttribute('placeholder-ru')) {
                element.setAttribute('placeholder', element.getAttribute('placeholder-ru'));
            }
        } else if (lang === 'kz') {
            if (element.hasAttribute('data-kz')) {
                element.textContent = element.getAttribute('data-kz');
            }
            if (element.hasAttribute('placeholder-kz')) {
                element.setAttribute('placeholder', element.getAttribute('placeholder-kz'));
            }
        }
    });

    currentLanguage = lang;
}

function updateModelFilter() {
    const brandFilter = document.getElementById('brandFilter');
    const modelFilter = document.getElementById('modelFilter');
    const selectedBrand = brandFilter.value;
    
    // Сохраняем текущее значение
    const currentValue = modelFilter.value;
    
    modelFilter.innerHTML = '<option value="" data-ru="Все модели" data-kz="Барлық үлгілер">Все модели</option>';
    
    if (selectedBrand && brandsAndModels[selectedBrand]) {
        // Сортируем модели перед добавлением
        Array.from(brandsAndModels[selectedBrand]).sort().forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelFilter.appendChild(option);
        });
    }
    
    // Восстанавливаем выбранное значение, если оно есть
    if (currentValue && Array.from(modelFilter.options).some(opt => opt.value === currentValue)) {
        modelFilter.value = currentValue;
    }
}

function applyFilters() {
    const brand = document.getElementById('brandFilter').value;
    const model = document.getElementById('modelFilter').value;
    const yearFrom = document.getElementById('yearFrom').value;
    const yearTo = document.getElementById('yearTo').value;

    filteredCars = carsData.filter(car => {
        // Проверка бренда
        const brandMatch = !brand || car.brand === brand;
        
        // Проверка модели
        const modelMatch = !model || car.model === model;
        
        // Проверка года
        const yearMatch = (!yearFrom || car.year >= parseInt(yearFrom)) && 
                         (!yearTo || car.year <= parseInt(yearTo));
        
        return brandMatch && modelMatch && yearMatch;
    });

    renderCars();
}

let currentSort = {
    type: null,
    order: 'asc'
};

function sortCars(type) {
    const buttons = document.querySelectorAll('.sort-btn');

    if (currentSort.type === type) {
        // Переключаем порядок
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.type = type;
        currentSort.order = 'asc';
    }

    if (type === 'price') {
        filteredCars.sort((a, b) => currentSort.order === 'asc' ? a.price - b.price : b.price - a.price);
    } else if (type === 'year') {
        filteredCars.sort((a, b) => currentSort.order === 'asc' ? a.year - b.year : b.year - a.year);
    }

    // Обновляем стрелки
    buttons.forEach(btn => {
        const btnType = btn.getAttribute('data-type');
        const arrow = btn.querySelector('.arrow');
        if (btnType === currentSort.type) {
            arrow.innerHTML = currentSort.order === 'asc' ? '▲' : '▼';
        } else {
            arrow.innerHTML = '';
        }
    });

    renderCars();
}

// Глобальный объект для хранения состояний галереи
const galleryStates = {};

function initCarGallery(car) {
    if (!galleryStates[car.id]) {
        galleryStates[car.id] = {
            currentIndex: 0,
            images: car.images || [car.imageUrl || 'https://via.placeholder.com/300']
        };
    }
    return galleryStates[car.id];
}

function renderCars() {
    const grid = document.getElementById('carsGrid');
    grid.innerHTML = '';

    filteredCars.forEach(car => {
        const gallery = initCarGallery(car);
        const carCard = createCarCard(car, gallery);
        grid.appendChild(carCard);
    });
}

function renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    const favoriteCars = carsData.filter(car => favorites.includes(car.id));
    
    if (favoriteCars.length === 0) {
        grid.innerHTML = '<p data-ru="Нет избранных автомобилей" data-kz="Таңдаулы автокөліктер жоқ">Нет избранных автомобилей</p>';
        switchLanguage(currentLanguage);
        return;
    }

    grid.innerHTML = '';
    favoriteCars.forEach(car => {
        if (!galleryStates[car.id]) {
            galleryStates[car.id] = {
                currentIndex: 0,
                images: car.images || [car.imageUrl || 'https://via.placeholder.com/300']
            };
        }
        const gallery = galleryStates[car.id];
        
        const carCard = createCarCard(car, gallery);
        grid.appendChild(carCard);
    });
}

function createCarCard(car, gallery) {
    const carCard = document.createElement('div');
    carCard.className = 'car-card';
    
    carCard.innerHTML = `
        <div class="car-image-container" id="carImageContainer-${car.id}">
            <div class="car-image-slider" id="carImageSlider-${car.id}" 
                 style="transform: translateX(-${gallery.currentIndex * 100}%)">
                ${gallery.images.map(img => `
                    <div class="car-image-slide">
                        <img src="${img}" alt="${car.name}" onerror="this.src='https://via.placeholder.com/300'">
                    </div>
                `).join('')}
            </div>
            ${gallery.images.length > 1 ? `
                <div class="car-image-nav">
                    <button class="car-image-btn" onclick="event.stopPropagation(); prevCardImage('${car.id}')">❮</button>
                    <button class="car-image-btn" onclick="event.stopPropagation(); nextCardImage('${car.id}')">❯</button>
                </div>
                <div class="car-image-dots">
                    ${gallery.images.map((_, index) => `
                        <div class="car-image-dot ${index === gallery.currentIndex ? 'active' : ''}" 
                             onclick="event.stopPropagation(); goToCardImage('${car.id}', ${index})"></div>
                    `).join('')}
                </div>
            ` : ''}
        </div>

        <div class="installment-label" data-ru="Рассрочка 0-0-24" data-kz="Бөліп төлеу 0-0-24">Рассрочка 0-0-24</div>

        <div class="car-info">
            <h3 class="car-title">${car.name}</h3>
            <div class="car-price" data-ru="От ${car.price.toLocaleString()} ₸" data-kz="${car.price.toLocaleString()} ₸ бастап">
                ${currentLanguage === 'kz' ? car.price.toLocaleString() + ' бастап' : 'От ' + car.price.toLocaleString()}
            </div>
            <div class="car-details">
                <div class="car-detail" data-ru="Год: ${car.year}" data-kz="Жыл: ${car.year}">Год: ${car.year}</div>
                <div class="car-detail" data-ru="КПП: ${car.transmission}" data-kz="Қорап түрі: ${car.transmission}">КПП: ${car.transmission}</div>
                <div class="car-detail" data-ru="Тип двигателя: ${car.engineType}" data-kz="Қозғалтқыш түрі: ${car.engineType}">Тип двигателя: ${car.engineType}</div>
            </div>
        </div>

        <button class="favorite-btn ${favorites.includes(car.id) ? 'active' : ''}" 
                onclick="toggleFavorite('${car.id}', event)">
            ❤️
        </button>
    `;
    
    // Применяем текущий язык к карточке
    const elements = carCard.querySelectorAll('[data-ru], [data-kz]');
    elements.forEach(element => {
        if (currentLanguage === 'ru' && element.hasAttribute('data-ru')) {
            element.textContent = element.getAttribute('data-ru');
            
        } else if (currentLanguage === 'kz' && element.hasAttribute('data-kz')) {
            element.textContent = element.getAttribute('data-kz');
            
        }
    });
    
    carCard.addEventListener('click', () => showCarDetail(car));
    return carCard;
}

function updateCardGallery(carId) {
    const gallery = galleryStates[carId];
    if (!gallery) {
        console.warn(`Gallery state not found for car ${carId}`);
        return;
    }
    
    const slider = document.getElementById(`carImageSlider-${carId}`);
    if (slider) {
        slider.style.transform = `translateX(-${gallery.currentIndex * 100}%)`;
    }
    
    const dots = document.querySelectorAll(`#carImageContainer-${carId} .car-image-dot`);
    dots.forEach((dot, index) => {
        if (dot) dot.classList.toggle('active', index === gallery.currentIndex);
    });
}

function nextCardImage(carId) {
    const gallery = galleryStates[carId];
    if (!gallery) {
        console.warn(`Gallery state not found for car ${carId}`);
        return;
    }
    
    gallery.currentIndex = (gallery.currentIndex + 1) % gallery.images.length;
    updateCardGallery(carId);
}

function prevCardImage(carId) {
    const gallery = galleryStates[carId];
    if (!gallery) {
        console.warn(`Gallery state not found for car ${carId}`);
        return;
    }
    
    gallery.currentIndex = (gallery.currentIndex - 1 + gallery.images.length) % gallery.images.length;
    updateCardGallery(carId);
}

function goToCardImage(carId, index) {
    const gallery = galleryStates[carId];
    if (!gallery) {
        console.warn(`Gallery state not found for car ${carId}`);
        return;
    }
    
    gallery.currentIndex = index;
    updateCardGallery(carId);
}

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('catalogTab').classList.toggle('hidden', tabName !== 'catalog');
    document.getElementById('favoritesTab').classList.toggle('hidden', tabName !== 'favorites');
    
    if (tabName === 'favorites') {
        renderFavorites();
    }
}

function showCarDetail(car) {
    const detailFrame = document.getElementById('detailFrame');
    const detailContent = document.getElementById('detailContent');
    const detailOverlay = document.getElementById('detailOverlay');

    detailOverlay.classList.add('active');

    const averagePrice = Math.round(car.price * 1.1);
    const savings = averagePrice - car.price;
    const savingsPercent = Math.round((savings / averagePrice) * 100);
    
    const images = car.images || [car.imageUrl || 'https://via.placeholder.com/300'];
    
    // Функция для проверки, нужно ли отображать поле
    const shouldShowField = (value) => value !== null && value !== undefined && value !== '';
    
    // Функция для форматирования значений
    const formatValue = (value, suffix = '') => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' && suffix === ' ₸') {
            return value.toLocaleString() + suffix;
        }
        return value + suffix;
    };

    // Генерация HTML для характеристик
    const characteristicsHTML = [
        { label: currentLanguage === 'kz' ? 'Мекен-жай' : 'Адрес', value: car.address },
        { label: currentLanguage === 'kz' ? 'Жыл' : 'Год выпуска', value: car.year },
        { label: currentLanguage === 'kz' ? 'Түс' : 'Цвет', value: car.color },
        { label: currentLanguage === 'kz' ? 'Қорап түрі' : 'КПП', value: car.transmission },
        { label: currentLanguage === 'kz' ? 'Қозғалтқыш түрі' : 'Тип двигателя', value: car.engineType },
        { label: currentLanguage === 'kz' ? 'Қозғалтқыш көлемі' : 'Объем двигателя', value: car.engine, suffix: 'L' },
        { label: currentLanguage === 'kz' ? 'Қуат' : 'Мощность', value: car.power, suffix: currentLanguage === 'kz' ? ' а.к.' : ' л.с.' },
        { label: currentLanguage === 'kz' ? 'Айналым моменті' : 'Крутящий момент', value: car.torque, suffix: currentLanguage === 'kz' ? ' Н·м' : ' Н·м' },
        { label: currentLanguage === 'kz' ? 'Макс. жылдамдық' : 'Макс. скорость', value: car.maxSpeed, suffix: currentLanguage === 'kz' ? ' км/сағ' : ' км/ч' },
        { label: currentLanguage === 'kz' ? 'Үдеу 0-100 км/сағ' : 'Разгон 0-100 км/ч', value: car.acceleration, suffix: currentLanguage === 'kz' ? ' сек' : ' сек' },
        { label: currentLanguage === 'kz' ? 'Өлшемдері (Ұ×Е×Б)' : 'Габариты (Д×Ш×В)', value: car.dimensions, suffix: currentLanguage === 'kz' ? ' мм' : ' мм' },
        { label: currentLanguage === 'kz' ? 'Диск өлшемі' : 'Размер диска', value: car.tireSize }
    ]
    .filter(item => item.value !== null && item.value !== undefined && item.value !== '')
    .filter(item => shouldShowField(item.value))
    .map(item => `
        <div class="char-item">
            <span>${item.label}:</span>
            <span>${formatValue(item.value, item.suffix || '')}</span>
        </div>
    `).join('');

    detailContent.innerHTML = `
        <button class="close-btn-mobile" onclick="closeDetail()">✕</button>   

        <div class="car-gallery">
            <div class="car-gallery-container" id="galleryContainer">
                ${images.map(img => `
                    <img src="${img}" alt="${car.name}" class="car-gallery-image" onerror="this.src='https://via.placeholder.com/300'">
                `).join('')}
            </div>
            
            <div class="gallery-nav">
                <button class="gallery-nav-btn" onclick="prevDetailImage()">❮</button>
                <button class="gallery-nav-btn" onclick="nextDetailImage()">❯</button>
            </div>
            
            <div class="gallery-dots" id="galleryDots">
                ${images.map((_, index) => `
                    <div class="gallery-dot ${index === 0 ? 'active' : ''}" onclick="goToDetailImage(${index})"></div>
                `).join('')}
            </div>
        </div>
        
        <h2>${car.name}</h2>
        
        <div class="price-section">
            <div class="average-price">${currentLanguage === 'kz' ? 'Басқа салондарда: ' : 'В других салонах: '}${car.averagePrice.toLocaleString()} ₸</div>
            <div class="our-price"><strong>${currentLanguage === 'kz' ? 'Біздің бағамыз: ' : 'Наша цена: '}${car.price.toLocaleString()} ₸</strong></div>
        </div>
        
        <div class="characteristics">
            <h4>${currentLanguage === 'kz' ? 'Сипаттамалары' : 'Характеристики'}</h4>
            <div class="char-grid">
                ${characteristicsHTML}
            </div>
        </div>
        
        <button class="apply-btn" onclick="showApplicationForm('${car.id}', '${car.name.replace(/'/g, "\\'")}')">
            ${currentLanguage === 'kz' ? 'Өтінім жіберу' : 'Отправить заявку'}
        </button>
    `;
    
    initDetailGallery(images.length);
    detailFrame.classList.add('open');
}

// Переменные для управления галереей в детальном просмотре
let currentDetailImageIndex = 0;
let totalDetailImages = 0;

function initDetailGallery(count) {
    currentDetailImageIndex = 0;
    totalDetailImages = count;
}

function updateDetailGallery() {
    const container = document.getElementById('galleryContainer');
    const dots = document.querySelectorAll('.gallery-dot');
    
    if (container) {
        container.style.transform = `translateX(-${currentDetailImageIndex * 100}%)`;
    }
    
    dots.forEach((dot, index) => {
        if (dot) dot.classList.toggle('active', index === currentDetailImageIndex);
    });
}

function nextDetailImage() {
    if (currentDetailImageIndex < totalDetailImages - 1) {
        currentDetailImageIndex++;
    } else {
        currentDetailImageIndex = 0;
    }
    updateDetailGallery();
}

function prevDetailImage() {
    if (currentDetailImageIndex > 0) {
        currentDetailImageIndex--;
    } else {
        currentDetailImageIndex = totalDetailImages - 1;
    }
    updateDetailGallery();
}

function goToDetailImage(index) {
    currentDetailImageIndex = index;
    updateDetailGallery();
}

function closeDetail() {
    document.getElementById('detailFrame').classList.remove('open');
    document.getElementById('detailOverlay').classList.remove('active');
}

function toggleFilterSidebar() {
    const sidebar = document.getElementById('filterSidebar');
    const overlay = document.getElementById('filterOverlay');

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeFilterSidebar() {
    document.getElementById('filterSidebar').classList.remove('active');
    document.getElementById('filterOverlay').classList.remove('active');
}

function closeModal() {
    document.getElementById('applicationModal').style.display = 'none';
}

// Event Listeners
document.getElementById('brandFilter').addEventListener('change', function() {
    updateModelFilter();
    applyFilters();
});

document.getElementById('modelFilter').addEventListener('change', applyFilters);
document.getElementById('yearFrom').addEventListener('input', applyFilters);
document.getElementById('yearTo').addEventListener('input', applyFilters);

// Close modal when clicking outside
document.getElementById('applicationModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Initialize
updateModelFilter();
renderCars();