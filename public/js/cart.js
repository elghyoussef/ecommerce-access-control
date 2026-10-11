const cartContainer = document.querySelector('.cart-container');

const productList = document.querySelector('.product-list');
const cartList = document.querySelector('.cart-list');
const cartTotalValue = document.getElementById('cart-total-value');

let cartItemID = 0;

eventListeners();


function eventListeners() {
    window.addEventListener('DOMContentLoaded', () => {
        loadJSON();
        fetchAndRenderCart();
        // Attach event listener to the correct container for delegation
        const allProducts = document.getElementById('all');
        if (allProducts) {
            allProducts.addEventListener('click', purchaseProduct);
        }
    });
    // Remove old event listener on productList if not needed
}
// show & hide Cart
function toggleHide() {
    let container = document.getElementById('cart');

    if (container.style.display != 'none') {
        container.style.display = 'none';
    }
    else {
        container.style.display = 'block';
    }
}
//Loading products from JSON to our Shop page
function loadJSON() {
  fetch('/api/products')
      .then(response => response.json())
      .then(data => {
          let html = '';
          data.forEach(product => {
              html += `
          <div class="product text-center col-lg-3 col-md-6 col-12">
      <img class="img-square" src="${product.imgsrc}" alt="">
      <div class="star">
        <i class='bx bxs-star'></i>
        <i class='bx bxs-star'></i>
        <i class='bx bxs-star'></i>
        <i class='bx bxs-star'></i>
        <i class='bx bxs-star'></i>
      </div>
      <h5 class="p-name">${product.name}</h5>
      <h4 class="p-price">$${product.price.toFixed(2)}</h4>
      <button class="buy-button">Add to Cart</button>
    </div>
    `;
          });
          document.getElementById('all').innerHTML = html;
      });
}
//cart hide/show and show cart items

function toggleHide(){
    let cart= document.getElementById('cart');

    if(cart.style.display != 'none' ){
        cart.style.display = 'none';
    }
    else{
        cart.style.display = 'block';
    }
    //To show items in cart after clicking on bag icon
       for(i=0; i<itemArray.length; i++)
        {
           document.getElementById('cart-list').innerHTML = itemArray[i];
        }
        window.scrollTo(0, 0); 
}


// Add to cart 

function purchaseProduct(e){
    if(e.target.classList.contains('buy-button')){
        let product = e.target.parentElement;
        
        getProductInfo(product);
    }
    cartItemID ++;
    
}

 function getProductInfo(product){
    let priceText = product.querySelector('.p-price').textContent;
    // Remove any non-numeric except dot and convert to float
    let price = parseFloat(priceText.replace(/[^\d.]/g, ''));
    let productInfo = {
        id : product.querySelector('.p-name').textContent + '-' + price, // unique id
        imgsrc : product.querySelector('.img-square').src,
        name : product.querySelector('.p-name').textContent,
        price : price,
    }
    addToCartBackend(productInfo);
 }

 // Fetch and render cart from backend
function fetchAndRenderCart() {
  fetch('/api/cart', { cache: 'no-store' })
    .then(res => {
      if (!res.ok) return [];
      return res.json();
    })
    .then(cart => {
      let count = 0;
      if (cart && cart.length) {
        cart.forEach(item => {
          count += item.quantity;
        });
      }
      // Update cart count everywhere
      if (document.getElementById('count')) document.getElementById('count').innerText = count;
      if (document.getElementById('item-count')) document.getElementById('item-count').innerText = count > 0 ? `Total-item: ${count}` : 'Cart is Empty';
      // If cart-list exists, render cart table (for cart page)
      if (document.getElementById('cart-list')) {
        let html = '';
        if (cart && cart.length) {
          cart.forEach(item => {
            let price = parseFloat(item.price);
            let itemTotal = price * item.quantity;
            html += `<tr data-id="${item.id}">
              <td><a href="#" onclick="removeFromCart('${item.id}')"><i class='bx bxs-trash-alt'></i></a></td>
              <td><img src="${item.imgsrc}" alt="Loading"></td>
              <td><h5 class="cart-item-name">${item.name}</h5></td>
              <td><h5 class="cart-item-price">${price.toFixed(2)} €</h5></td>
              <td><h5 class="cart-total-value">${itemTotal.toFixed(2)} €</h5></td>
            </tr>`;
          });
        }
        document.getElementById('cart-list').innerHTML = html || '<tr><td colspan="5">Votre panier est vide.</td></tr>';
      }
    })
    .catch(() => {
      if (document.getElementById('count')) document.getElementById('count').innerText = '0';
      if (document.getElementById('item-count')) document.getElementById('item-count').innerText = 'Erreur lors du chargement du panier.';
      if (document.getElementById('cart-list')) document.getElementById('cart-list').innerHTML = '<tr><td colspan="5">Erreur lors du chargement du panier.</td></tr>';
    });
}

// Add to cart using backend
function addToCartBackend(productInfo) {
  fetch('/api/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: productInfo.id,
      name: productInfo.name,
      price: productInfo.price, // Already a float
      quantity: 1,
      imgsrc: productInfo.imgsrc
    })
  })
  .then(res => res.json())
  .then(() => {
    fetchAndRenderCart();
    // msg(); // Removed add-to-cart animation
  });
}

// Remove from cart using backend
function removeFromCart(id) {
  fetch('/api/cart/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  .then(res => res.json())
  .then(() => {
    fetchAndRenderCart();
  });
}

// To show aknowledgement msg after clicking on add to cart button
  
  function msg()
  {
    let msg = document.getElementById('msg-appear');
    msg.style.display ='block';
    setTimeout(hideElement, 1500);

    function hideElement(){
          msg.style.display ='none';
    }
  }

// On page load, always update cart count
window.addEventListener('DOMContentLoaded', () => {
  if (typeof fetchAndRenderCart === 'function') fetchAndRenderCart();
});

