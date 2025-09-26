// Global variables
let filteredProducts = [];
let currentSearchTerm = '';
let currentFilters = {
    categories: ['all'], // Initialize with 'all' since it's checked by default
    availability: ['in-stock'], // Initialize with 'in-stock' since it's checked by default
    priceRange: { min: 0, max: 1000000 },
    materials: [],
    stoneTypes: [],
    brands: [],
    genders: [],
    occasions: []
};
let currentPage = 1;
let totalPages = 1;
let isLoading = false;

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsCount = document.getElementById('resultsCount');
const productsGrid = document.getElementById('productsGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadInitialData();
});

// Event Listeners
function initializeEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', handleSearchInput);
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Add keyboard navigation for suggestions
    searchInput.addEventListener('keydown', handleSearchKeydown);

    // Filter functionality
    setupFilterListeners();
    
    // Price range
    setupPriceRangeListeners();
    
    // Load more button
    loadMoreBtn.addEventListener('click', loadMoreProducts);
    
}

function setupFilterListeners() {
    // Set up event delegation for dynamically created checkboxes
    document.addEventListener('change', function(event) {
        if (event.target.type === 'checkbox' && event.target.closest('.filter-content')) {
            handleFilterChange(event);
        }
    });
    
    // Also prevent any form submission that might be happening
    document.addEventListener('submit', function(event) {
        if (event.target.closest('.filter-content') || event.target.closest('.sidebar')) {
            event.preventDefault();
            console.log('Prevented form submission in filter area');
        }
    });
    
    // Prevent any click events that might cause navigation
    document.addEventListener('click', function(event) {
        if (event.target.closest('.filter-content') && event.target.type === 'checkbox') {
            // Let the change event handle it, but prevent any other behavior
            event.stopPropagation();
        }
    });
}

function setupPriceRangeListeners() {
    const priceRange = document.getElementById('priceRange');
    const minPrice = document.getElementById('minPrice');
    const maxPrice = document.getElementById('maxPrice');
    const applyBtn = document.getElementById('applyPrice');

    priceRange.addEventListener('input', function() {
        maxPrice.value = this.value;
    });

    minPrice.addEventListener('input', function() {
        if (parseInt(this.value) > parseInt(maxPrice.value)) {
            this.value = maxPrice.value;
        }
    });

    maxPrice.addEventListener('input', function() {
        if (parseInt(this.value) < parseInt(minPrice.value)) {
            this.value = minPrice.value;
        }
    });

    applyBtn.addEventListener('click', function() {
        currentFilters.priceRange = {
            min: parseInt(minPrice.value) || 0,
            max: parseInt(maxPrice.value) || 1000000
        };
        currentPage = 1;
        loadProducts(1);
    });
}


// API Functions
async function loadInitialData() {
    try {
        showLoading();
        await Promise.all([
            loadProducts(),
            loadFilterOptions()
        ]);
        hideLoading();
    } catch (error) {
        console.error('Error loading initial data:', error);
        hideLoading();
        showError('Failed to load data. Please refresh the page.');
    }
}

async function loadProducts(page = 1, append = false) {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();

        // Always use products API since it supports both search and filters
        const params = new URLSearchParams({
            page: page,
            limit: 10,
            search: currentSearchTerm,
            minPrice: currentFilters.priceRange.min,
            maxPrice: currentFilters.priceRange.max
        });

        // Add all filters to products API
        // Add category filters
        if (currentFilters.categories.length > 0 && !currentFilters.categories.includes('all')) {
            currentFilters.categories.forEach(category => {
                params.append('category', category);
            });
        }

        // Add material filters
        if (currentFilters.materials.length > 0) {
            currentFilters.materials.forEach(material => {
                params.append('material', material);
            });
        }

        // Add stone type filters
        if (currentFilters.stoneTypes && currentFilters.stoneTypes.length > 0) {
            currentFilters.stoneTypes.forEach(stoneType => {
                params.append('stone_type', stoneType);
            });
        }

        // Add brand filters
        if (currentFilters.brands && currentFilters.brands.length > 0) {
            currentFilters.brands.forEach(brand => {
                params.append('brand', brand);
            });
        }

        // Add gender filters
        if (currentFilters.genders && currentFilters.genders.length > 0) {
            currentFilters.genders.forEach(gender => {
                params.append('gender', gender);
            });
        }

        // Add occasion filters
        if (currentFilters.occasions && currentFilters.occasions.length > 0) {
            currentFilters.occasions.forEach(occasion => {
                params.append('occasion', occasion);
            });
        }

        // Add availability filter
        if (currentFilters.availability.length > 0) {
            if (currentFilters.availability.includes('in-stock')) {
                params.append('inStock', 'true');
            }
            if (currentFilters.availability.includes('out-of-stock')) {
                params.append('inStock', 'false');
            }
        }

        // Always use products API since it supports both search and filters
        const response = await fetch(`http://localhost:5500/api/products?${params}`);
        const data = await response.json();

        if (data.success) {
            if (append) {
                filteredProducts = [...filteredProducts, ...data.data.products];
            } else {
                filteredProducts = data.data.products;
            }
            
            // Always use products API response structure
            currentPage = data.data.pagination.page;
            totalPages = data.data.pagination.pages;
            displayProducts(filteredProducts);
            // Handle both number and object formats for total
            const total = typeof data.data.pagination.total === 'object' ? data.data.pagination.total.value : data.data.pagination.total;
            updateResultsCount(total);
            updateLoadMoreButton();
        } else {
            throw new Error(data.error || 'Failed to load products');
        }
        
        // Reload filters after loading products to show relevant filters
        if (!append) {
            loadFilterOptions();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please try again.');
    } finally {
        isLoading = false;
        hideLoading();
    }
}

async function loadFilterOptions() {
    try {
        // Build parameters based on current search and filters
        const params = new URLSearchParams();
        
        if (currentSearchTerm) {
            params.append('search', currentSearchTerm);
        }
        
        // Don't send category filters to preserve all category options
        // This allows users to select multiple categories without losing options
        if (currentFilters.categories.length > 0 && !currentFilters.categories.includes('all')) {
            currentFilters.categories.forEach(category => {
                params.append('category', category);
            });
        }
        
        if (currentFilters.materials.length > 0) {
            currentFilters.materials.forEach(material => {
                params.append('material', material);
            });
        }
        
        if (currentFilters.stoneTypes.length > 0) {
            currentFilters.stoneTypes.forEach(stoneType => {
                params.append('stone_type', stoneType);
            });
        }
        
        if (currentFilters.brands.length > 0) {
            currentFilters.brands.forEach(brand => {
                params.append('brand', brand);
            });
        }
        
        if (currentFilters.genders.length > 0) {
            currentFilters.genders.forEach(gender => {
                params.append('gender', gender);
            });
        }
        
        if (currentFilters.occasions.length > 0) {
            currentFilters.occasions.forEach(occasion => {
                params.append('occasion', occasion);
            });
        }
        
        if (currentFilters.priceRange) {
            params.append('minPrice', currentFilters.priceRange.min);
            params.append('maxPrice', currentFilters.priceRange.max);
        }
        
        if (currentFilters.availability.length > 0) {
            if (currentFilters.availability.includes('in-stock')) {
                params.append('inStock', 'true');
            }
            if (currentFilters.availability.includes('out-of-stock')) {
                params.append('inStock', 'false');
            }
        }
        
        const response = await fetch(`http://localhost:5500/api/filters?${params}`);
        const data = await response.json();

        if (data.success) {
            updateFilterCounts(data.data);
            updatePriceRangeUI(data.data.priceRange);
        }
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

async function searchProducts(query) {
    if (!query.trim()) {
        await loadProducts(1);
        return;
    }

    // Set the search term and use loadProducts to handle the search
    currentSearchTerm = query;
    await loadProducts(1);
}

// Search functionality
let searchTimeout;
let suggestionsContainer;
let selectedSuggestionIndex = -1;

function handleSearchInput() {
    const query = searchInput.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Hide suggestions if query is too short
    if (query.length < 2) {
        hideSuggestions();
        return;
    }
    
    // Debounce the search suggestions
    searchTimeout = setTimeout(() => {
        loadSearchSuggestions(query);
    }, 300);
}

function handleSearch() {
    const query = searchInput.value.trim();
    hideSuggestions();
    
    if (query !== currentSearchTerm) {
        currentSearchTerm = query;
        currentPage = 1;
        loadProducts(1);
    }
}

// Load search suggestions
async function loadSearchSuggestions(query) {
    try {
        const response = await fetch(`http://localhost:5500/api/suggestions?q=${encodeURIComponent(query)}&limit=8`);
        const data = await response.json();
        
        if (data.success && data.data.suggestions.length > 0) {
            showSuggestions(data.data.suggestions);
        } else {
            hideSuggestions();
        }
    } catch (error) {
        console.error('Error loading search suggestions:', error);
        hideSuggestions();
    }
}

// Show search suggestions
function showSuggestions(suggestions) {
    // Remove existing suggestions container
    hideSuggestions();
    
    // Reset selected index
    selectedSuggestionIndex = -1;
    
    // Create suggestions container
    suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'search-suggestions';
    suggestionsContainer.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-top: none;
        border-radius: 0 0 8px 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-height: 300px;
        overflow-y: auto;
    `;
    
    // Add suggestions
    suggestions.forEach(suggestion => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.style.cssText = `
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: center;
            transition: background-color 0.2s;
        `;
        
        // Add icon based on type
        const icon = suggestion.type === 'brand' ? '🏷️' : '💎';
        
        suggestionItem.innerHTML = `
            <span style="margin-right: 8px; font-size: 16px;">${icon}</span>
            <span style="flex: 1;">${suggestion.text}</span>
            <span style="font-size: 12px; color: #666; background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">${suggestion.type}</span>
        `;
        
        // Add hover effect
        suggestionItem.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f8f9fa';
        });
        
        suggestionItem.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'white';
        });
        
        // Add click handler
        suggestionItem.addEventListener('click', function() {
            searchInput.value = suggestion.text;
            hideSuggestions();
            handleSearch();
        });
        
        suggestionsContainer.appendChild(suggestionItem);
    });
    
    // Position the suggestions container
    const searchContainer = searchInput.closest('.search-container');
    if (searchContainer) {
        searchContainer.style.position = 'relative';
        searchContainer.appendChild(suggestionsContainer);
    }
}

// Hide search suggestions
function hideSuggestions() {
    if (suggestionsContainer) {
        suggestionsContainer.remove();
        suggestionsContainer = null;
    }
}

// Keyboard navigation for suggestions
function handleSearchKeydown(e) {
    if (!suggestionsContainer) return;
    
    const suggestionItems = suggestionsContainer.querySelectorAll('.suggestion-item');
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestionItems.length - 1);
            updateSelectedSuggestion(suggestionItems);
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSelectedSuggestion(suggestionItems);
            break;
            
        case 'Enter':
            if (selectedSuggestionIndex >= 0 && suggestionItems[selectedSuggestionIndex]) {
                e.preventDefault();
                suggestionItems[selectedSuggestionIndex].click();
            }
            break;
            
        case 'Escape':
            hideSuggestions();
            selectedSuggestionIndex = -1;
            break;
    }
}

// Update selected suggestion styling
function updateSelectedSuggestion(suggestionItems) {
    suggestionItems.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.style.backgroundColor = '#e3f2fd';
            item.style.borderLeft = '3px solid #2196f3';
        } else {
            item.style.backgroundColor = 'white';
            item.style.borderLeft = 'none';
        }
    });
}

// Hide suggestions when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.search-container')) {
        hideSuggestions();
        selectedSuggestionIndex = -1;
    }
});

// Filter functionality
function handleFilterChange(event) {
    // Prevent any default behavior that might cause page refresh
    event.preventDefault();
    event.stopPropagation();
    
    const checkbox = event.target;
    const value = checkbox.value;
    const filterType = getFilterType(checkbox);

    console.log(`Filter changed: ${filterType} = ${value}, checked: ${checkbox.checked}`);

    // Special handling for categories
    if (filterType === 'categories') {
        if (value === 'all') {
            if (checkbox.checked) {
                // If "All Products" is checked, clear all other categories
                currentFilters.categories = ['all'];
                // Uncheck all other category checkboxes
                document.querySelectorAll('#categoriesFilter input[type="checkbox"]:not([value="all"])').forEach(cb => {
                    cb.checked = false;
                });
            } else {
                // If "All Products" is unchecked, remove it
                currentFilters.categories = currentFilters.categories.filter(item => item !== 'all');
            }
        } else {
            // Individual category selection
            if (checkbox.checked) {
                // Remove "all" if it exists and add the specific category
                currentFilters.categories = currentFilters.categories.filter(item => item !== 'all');
                if (!currentFilters.categories.includes(value)) {
                    currentFilters.categories.push(value);
                }
                // Uncheck "All Products" checkbox
                const allCheckbox = document.querySelector('#categoriesFilter input[value="all"]');
                if (allCheckbox) {
                    allCheckbox.checked = false;
                }
            } else {
                // Remove the specific category
                currentFilters.categories = currentFilters.categories.filter(item => item !== value);
                // If no categories are selected, check "All Products"
                if (currentFilters.categories.length === 0) {
                    currentFilters.categories = ['all'];
                    const allCheckbox = document.querySelector('#categoriesFilter input[value="all"]');
                    if (allCheckbox) {
                        allCheckbox.checked = true;
                    }
                }
            }
        }
    } else {
        // Regular filter handling for non-categories
        if (checkbox.checked) {
            if (!currentFilters[filterType].includes(value)) {
                currentFilters[filterType].push(value);
            }
        } else {
            currentFilters[filterType] = currentFilters[filterType].filter(item => item !== value);
        }
    }

    console.log('Current filters:', currentFilters);

    currentPage = 1;
    loadProducts(1);
}

function getFilterType(checkbox) {
    const parentSection = checkbox.closest('.filter-section');
    const title = parentSection.querySelector('.filter-title').textContent.trim();
    
    if (title.includes('CATEGORIES')) return 'categories';
    if (title.includes('AVAILABILITY')) return 'availability';
    if (title.includes('MATERIALS')) return 'materials';
    if (title.includes('STONE TYPES')) return 'stoneTypes';
    if (title.includes('BRANDS')) return 'brands';
    if (title.includes('GENDER')) return 'genders';
    if (title.includes('OCCASIONS')) return 'occasions';
    
    return 'categories';
}

// Helper functions for updating UI
function updateFilterCounts(filterData) {
    // Populate categories dynamically
    populateFilterSection('categoriesFilter', filterData.categories, 'categories');
    
    // Populate materials dynamically
    populateFilterSection('materialsFilter', filterData.materials, 'materials');
    
    // Populate stone types dynamically
    populateFilterSection('stoneTypesFilter', filterData.stone_types, 'stoneTypes');
    
    // Populate brands dynamically
    populateFilterSection('brandsFilter', filterData.brands, 'brands');
    
    // Populate genders dynamically
    populateFilterSection('genderFilter', filterData.genders, 'genders');
    
    // Populate occasions dynamically
    populateFilterSection('occasionsFilter', filterData.occasions, 'occasions');

    // Update stock counts
    if (filterData.stock) {
        const inStockElement = document.getElementById('inStockCount');
        const outOfStockElement = document.getElementById('outOfStockCount');
        if (inStockElement) inStockElement.textContent = filterData.stock.inStock;
        if (outOfStockElement) outOfStockElement.textContent = filterData.stock.outOfStock;
    }
    
    // Preserve availability filter states
    const inStockCheckbox = document.querySelector('input[value="in-stock"]');
    const outOfStockCheckbox = document.querySelector('input[value="out-of-stock"]');
    if (inStockCheckbox) {
        inStockCheckbox.checked = currentFilters.availability.includes('in-stock');
    }
    if (outOfStockCheckbox) {
        outOfStockCheckbox.checked = currentFilters.availability.includes('out-of-stock');
    }
}

// Function to populate filter sections dynamically
function populateFilterSection(containerId, filterData, filterType) {
    const container = document.getElementById(containerId);
    if (!container || !filterData || filterData.length === 0) {
        return;
    }

    // Clear existing content (except for categories which has "All Products")
    if (filterType !== 'categories') {
        container.innerHTML = '';
    } else {
        // For categories, keep the "All Products" option
        const allProductsOption = container.querySelector('input[value="all"]').parentElement;
        container.innerHTML = '';
        container.appendChild(allProductsOption);
        
        // Preserve the "All Products" checkbox state
        const allCheckbox = allProductsOption.querySelector('input[value="all"]');
        if (allCheckbox) {
            allCheckbox.checked = currentFilters.categories.includes('all');
        }
    }

    // Add filter options
    filterData.forEach(item => {
        const label = document.createElement('label');
        label.className = 'filter-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.value;
        
        // Preserve the selected state based on current filters
        if (currentFilters[filterType] && currentFilters[filterType].includes(item.value)) {
            checkbox.checked = true;
        }
        
        const span = document.createElement('span');
        span.textContent = `${item.value} (${item.count})`;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function updatePriceRangeUI(priceRange) {
    const priceRangeSlider = document.getElementById('priceRange');
    const minPriceInput = document.getElementById('minPrice');
    const maxPriceInput = document.getElementById('maxPrice');

    if (priceRangeSlider && priceRange) {
        // Only update the slider's max value and input placeholders
        // Don't change the current user's filter settings
        priceRangeSlider.max = priceRange.max;
        
        // Update input placeholders to show the available range
        if (maxPriceInput) {
            maxPriceInput.placeholder = `Max: ${priceRange.max}`;
        }
        if (minPriceInput) {
            minPriceInput.placeholder = `Min: ${priceRange.min}`;
        }
        
        // Don't update currentFilters.priceRange - let user control it
    }
}

function updateLoadMoreButton() {
    if (currentPage >= totalPages) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }
}

// Display products
function displayProducts(products) {
    productsGrid.innerHTML = '';
    
    if (products.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <h3>No products found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }

    products.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
    
    // Initialize image sliders after all product cards are created
    initializeImageSliders();
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Handle multiple images
    let imageDisplay;
    let images = [];
    
    if (product.images) {
        // Split images by semicolon and clean up
        images = product.images.split(';').map(img => img.trim()).filter(img => img.length > 0);
    }
    
    if (images.length > 1) {
        // Create image slider for multiple images
        const sliderId = `slider-${Math.random().toString(36).substr(2, 9)}`;
        imageDisplay = createImageSlider(images, sliderId, product.product_name);
        // Add image count indicator for multiple images
        imageDisplay += `<div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 8px; font-size: 11px; font-weight: bold;">${images.length} Photos</div>`;
    } else if (images.length === 1) {
        // Single image
        imageDisplay = `<img src="${images[0]}" alt="${product.product_name}" style="width: 100%; height: 200px; object-fit: cover;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='">`;
    } else {
        // No image - placeholder
        imageDisplay = '<div style="width: 100%; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 2rem;">💎</div>';
    }
    
    // Handle price display
    const originalPrice = product.price_before_discount_inr || 0;
    const currentPrice = product.price_after_discount_inr || 0;
    const discount = product.discount_pct || 0;
    
    // Handle material and stone type
    const material = product.base_metal || 'Gold';
    const stoneType = product.stone_type || 'Diamond';
    const brand = product.brand || 'CaratBazaar';
    
    card.innerHTML = `
        <div class="product-image">
            ${imageDisplay}
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.product_name || 'Jewelry Product'}</h3>
            <div class="product-brand">
                <small>${brand}</small>
            </div>
            <div class="product-price">
                ${originalPrice > 0 ? `<span class="original-price">₹${originalPrice.toLocaleString()}</span>` : ''}
                <span class="current-price">From ₹${currentPrice.toLocaleString()}</span>
                ${discount > 0 ? `<span class="discount-badge">Save ${discount}%</span>` : ''}
            </div>
            <div class="product-details">
                <small>${material.toUpperCase()} • ${stoneType.charAt(0).toUpperCase() + stoneType.slice(1)}</small>
                ${product.gender ? `<br><small>For: ${product.gender}</small>` : ''}
                ${product.occasion ? `<br><small>Occasion: ${Array.isArray(product.occasion) ? product.occasion.join(', ') : product.occasion}</small>` : ''}
            </div>
            <div class="product-specs">
                ${product.total_carat_weight ? `<small>Weight: ${product.total_carat_weight}</small>` : ''}
                ${product.stone_clarity ? `<br><small>Clarity: ${product.stone_clarity}</small>` : ''}
                ${product.stone_color ? `<br><small>Color: ${product.stone_color}</small>` : ''}
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        // Product details functionality (can be expanded later)
        showProductDetails(product);
    });

    return card;
}

// Function to create image slider
function createImageSlider(images, sliderId, productName) {
    const totalImages = images.length;
    const showDots = totalImages <= 8; // Only show dots for 8 or fewer images
    
    return `
        <div class="image-slider" id="${sliderId}" style="position: relative; width: 100%; height: 200px; overflow: hidden; border-radius: 8px;">
            <div class="slider-container" style="display: flex; transition: transform 0.3s ease; height: 100%;">
                ${images.map((img, index) => `
                    <div class="slide" style="min-width: 100%; height: 100%;">
                        <img src="${img}" alt="${productName} - Image ${index + 1}" 
                             style="width: 100%; height: 100%; object-fit: cover;"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='">
                    </div>
                `).join('')}
            </div>
            
            ${totalImages > 1 ? `
                ${showDots ? `
                    <div class="slider-nav" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px;">
                        ${images.map((_, index) => `
                            <button class="slider-dot" data-slide="${index}" 
                                    style="width: 8px; height: 8px; border-radius: 50%; border: none; background: ${index === 0 ? '#2196f3' : 'rgba(255,255,255,0.5)'}; cursor: pointer; transition: background 0.3s;">
                            </button>
                        `).join('')}
                    </div>
                ` : `
                    <div class="slider-counter" style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                        <span class="current-slide">1</span> / ${totalImages}
                    </div>
                `}
                
                <div class="slider-arrows" style="position: absolute; top: 50%; transform: translateY(-50%); width: 100%; display: flex; justify-content: space-between; padding: 0 10px; pointer-events: none;">
                    <button class="slider-prev" style="background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; pointer-events: auto; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold;">‹</button>
                    <button class="slider-next" style="background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; pointer-events: auto; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold;">›</button>
                </div>
            ` : ''}
        </div>
    `;
}

// Function to initialize image sliders
function initializeImageSliders() {
    const sliders = document.querySelectorAll('.image-slider');
    
    sliders.forEach(slider => {
        const container = slider.querySelector('.slider-container');
        const slides = slider.querySelectorAll('.slide');
        const dots = slider.querySelectorAll('.slider-dot');
        const prevBtn = slider.querySelector('.slider-prev');
        const nextBtn = slider.querySelector('.slider-next');
        
        let currentSlide = 0;
        const totalSlides = slides.length;
        
        if (totalSlides <= 1) return; // No need for slider if only one image
        
        // Update slider position
        function updateSlider() {
            container.style.transform = `translateX(-${currentSlide * 100}%)`;
            
            // Update dots (if they exist)
            if (dots.length > 0) {
                dots.forEach((dot, index) => {
                    dot.style.background = index === currentSlide ? '#2196f3' : 'rgba(255,255,255,0.5)';
                });
            }
            
            // Update counter (if it exists)
            const counter = slider.querySelector('.slider-counter .current-slide');
            if (counter) {
                counter.textContent = currentSlide + 1;
            }
        }
        
        // Next slide
        function nextSlide() {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateSlider();
        }
        
        // Previous slide
        function prevSlide() {
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            updateSlider();
        }
        
        // Auto-play slider
        let autoPlayInterval = setInterval(nextSlide, 3000);
        
        // Pause auto-play on hover
        slider.addEventListener('mouseenter', () => {
            clearInterval(autoPlayInterval);
        });
        
        slider.addEventListener('mouseleave', () => {
            autoPlayInterval = setInterval(nextSlide, 3000);
        });
        
        // Event listeners
        if (nextBtn) nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nextSlide();
        });
        
        if (prevBtn) prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prevSlide();
        });
        
        // Dot navigation
        dots.forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSlide = index;
                updateSlider();
            });
        });
        
        // Touch/swipe support for mobile
        let startX = 0;
        let isDragging = false;
        
        slider.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        });
        
        slider.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
        });
        
        slider.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            const endX = e.changedTouches[0].clientX;
            const diffX = startX - endX;
            
            if (Math.abs(diffX) > 50) { // Minimum swipe distance
                if (diffX > 0) {
                    nextSlide();
        } else {
                    prevSlide();
                }
            }
        });
    });
}

// Product details functionality
function showProductDetails(product) {
    // Create a modal or detailed view for the product
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow-y: auto; position: relative;">
            <button onclick="this.closest('.modal').remove()" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            <h2>${product.product_name || 'Product Details'}</h2>
            <div style="margin: 1rem 0;">
                <strong>Brand:</strong> ${product.brand || 'N/A'}<br>
                <strong>SKU:</strong> ${product.sku || 'N/A'}<br>
                <strong>Price:</strong> ₹${(product.price_after_discount_inr || 0).toLocaleString()}<br>
                ${product.price_before_discount_inr ? `<strong>Original Price:</strong> ₹${product.price_before_discount_inr.toLocaleString()}<br>` : ''}
                ${product.discount_pct ? `<strong>Discount:</strong> ${product.discount_pct}%<br>` : ''}
                <strong>Material:</strong> ${product.base_metal || 'N/A'}<br>
                <strong>Stone Type:</strong> ${product.stone_type || 'N/A'}<br>
                ${product.gender ? `<strong>Gender:</strong> ${product.gender}<br>` : ''}
                ${product.occasion ? `<strong>Occasion:</strong> ${Array.isArray(product.occasion) ? product.occasion.join(', ') : product.occasion}<br>` : ''}
                ${product.total_carat_weight ? `<strong>Weight:</strong> ${product.total_carat_weight}<br>` : ''}
                ${product.stone_clarity ? `<strong>Clarity:</strong> ${product.stone_clarity}<br>` : ''}
                ${product.stone_color ? `<strong>Color:</strong> ${product.stone_color}<br>` : ''}
                ${product.stone_cut ? `<strong>Cut:</strong> ${product.stone_cut}<br>` : ''}
            </div>
            ${product.product_description ? `<div style="margin: 1rem 0;"><strong>Description:</strong><br>${product.product_description}</div>` : ''}
            ${product.manufacturing_details ? `<div style="margin: 1rem 0;"><strong>Manufacturing Details:</strong><br>${product.manufacturing_details}</div>` : ''}
            ${product.care_instructions ? `<div style="margin: 1rem 0;"><strong>Care Instructions:</strong><br>${product.care_instructions}</div>` : ''}
            ${product.warranty_guarantee_of_polish ? `<div style="margin: 1rem 0;"><strong>Warranty:</strong><br>${product.warranty_guarantee_of_polish}</div>` : ''}
            ${product.return_policy ? `<div style="margin: 1rem 0;"><strong>Return Policy:</strong><br>${product.return_policy}</div>` : ''}
            ${product.delivery_time ? `<div style="margin: 1rem 0;"><strong>Delivery Time:</strong><br>${product.delivery_time}</div>` : ''}
        </div>
    `;
    
    modal.className = 'modal';
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Load more functionality
function loadMoreProducts() {
    if (currentPage < totalPages && !isLoading) {
        loadProducts(currentPage + 1, true);
    }
}

// Utility functions
function updateResultsCount(total = null) {
    const count = total !== null ? total : filteredProducts.length;
    const searchText = currentSearchTerm ? ` FOR '${currentSearchTerm.toUpperCase()}'` : '';
    resultsCount.textContent = `${count} RESULTS FOUND${searchText}`;
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bgColor = type === 'error' ? '#e74c3c' : '#d4af37';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        z-index: 3000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}


// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

