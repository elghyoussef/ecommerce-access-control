// P model for Node.js Express e-commerce app logic
// Author: [Your Name]
// Description: Models user, session, and product logic for simulation and testing
// To run: pcc model.p && ptest model.dll

// =====================
// Event Declarations
// =====================
event RegisterUser: (string, string, string);
event LoginUser: (string, string);
event LogoutUser;
event AddProduct: (string, int, string);
event EditProduct: (int, string, int);
event DeleteProduct: (int);
event GetProducts;
event GetUser;
event AuthSuccess: (user);
event AuthFail: (string);
event ProductAdded: (product);
event ProductEdited: (product);
event ProductDeleted: (int);
event ProductsList: (products);
event UserInfo: (user);
event Error: (string);

record User {
  id: int;
  username: string;
  email: string;
  password: string;
  isAdmin: bool;
}

record Product {
  id: int;
  name: string;
  price: int;
  imgsrc: string;
}

// =====================
// Machine: ProductManager
// =====================
machine ProductManager {
  var products : map[int, Product] = empty;
  var nextId : int = 1;

  start state Init {
    on AddProduct do handleAddProduct;
    on EditProduct do handleEditProduct;
    on DeleteProduct do handleDeleteProduct;
    on GetProducts do handleGetProducts;
  }

  fun handleAddProduct(e: AddProduct) {
    var id = nextId;
    nextId = nextId + 1;
    var p = Product{ id = id, name = e.name, price = e.price, imgsrc = e.imgsrc };
    products[id] = p;
    send e.sender, ProductAdded(p);
  }

  fun handleEditProduct(e: EditProduct) {
    if (e.id in products) {
      var old = products[e.id];
      var p = Product{ id = e.id, name = e.name, price = e.price, imgsrc = old.imgsrc };
      products[e.id] = p;
      send e.sender, ProductEdited(p);
    } else {
      send e.sender, Error("Edit non-existent product");
      assert false, "Tried to edit non-existent product";
    }
  }

  fun handleDeleteProduct(e: DeleteProduct) {
    if (e.id in products) {
      products -= e.id;
      send e.sender, ProductDeleted(e.id);
    } else {
      send e.sender, Error("Delete non-existent product");
      assert false, "Tried to delete non-existent product";
    }
  }

  fun handleGetProducts(e: GetProducts) {
    var arr = values(products);
    send e.sender, ProductsList(arr);
  }
}

// =====================
// Machine: UserManager
// =====================
machine UserManager {
  var users : map[string, User] = empty;
  var nextId : int = 1;

  start state Init {
    on RegisterUser do handleRegisterUser;
    on LoginUser do handleLoginUser;
    on GetUser do handleGetUser;
    on LogoutUser do handleLogoutUser;
  }

  fun handleRegisterUser(e: RegisterUser) {
    if (e.email in users) {
      send e.sender, AuthFail("Email already exists");
      assert false, "Duplicate registration";
    } else {
      var u = User{ id = nextId, username = e.username, email = e.email, password = e.password, isAdmin = false };
      users[e.email] = u;
      nextId = nextId + 1;
      send e.sender, AuthSuccess(u);
    }
  }

  fun handleLoginUser(e: LoginUser) {
    if (e.email in users && users[e.email].password == e.password) {
      send e.sender, AuthSuccess(users[e.email]);
    } else {
      send e.sender, AuthFail("Invalid credentials");
    }
  }

  fun handleGetUser(e: GetUser) {
    // For simplicity, always return the first user
    if (sizeof(users) > 0) {
      var u = values(users)[0];
      send e.sender, UserInfo(u);
    } else {
      send e.sender, Error("No user");
    }
  }

  fun handleLogoutUser(e: LogoutUser) {
    // No-op for stateless model
    send e.sender, AuthSuccess(User{ id = 0, username = "", email = "", password = "", isAdmin = false });
  }
}

// =====================
// Machine: Session
// =====================
machine Session {
  var user : User = User{ id = 0, username = "", email = "", password = "", isAdmin = false };
  var userManager : machine;
  var productManager : machine;

    start state Init with (payload: (machine, machine)) {
        entry {
            userManager = payload.0;
            productManager = payload.1;
        }
    on RegisterUser do forwardToUserManager;
    on LoginUser do forwardToUserManager;
    on LogoutUser do forwardToUserManager;
    on GetUser do forwardToUserManager;
    on AddProduct do forwardToProductManager;
    on EditProduct do forwardToProductManager;
    on DeleteProduct do forwardToProductManager;
    on GetProducts do forwardToProductManager;
    on AuthSuccess do setUser;
    on AuthFail do clearUser;
    on UserInfo do setUser;
    on Error do handleError;
  }

  fun forwardToUserManager(e) { send userManager, e; }
  fun forwardToProductManager(e) { send productManager, e; }
  fun setUser(e: AuthSuccess) { user = e.user; }
  fun setUser(e: UserInfo) { user = e.user; }
  fun clearUser(e: AuthFail) { user = User{ id = 0, username = "", email = "", password = "", isAdmin = false }; }
  fun handleError(e: Error) { assert false, e.reason; }
}

// =====================
// Test Harness
// =====================
machine Main {
  start state Init {
    entry { runTest(); }
  }

  fun runTest() {
    var userManager = create UserManager;
    var productManager = create ProductManager;
    var session = create Session((userManager, productManager));

    // Simulate all possible event sequences
    send session, RegisterUser("alice", "alice@example.com", "pw");
    send session, RegisterUser("bob", "bob@example.com", "pw");
    send session, LoginUser("alice@example.com", "pw");
    send session, AddProduct("shoes", 25, "img1.jpg");
    send session, AddProduct("shirt", 15, "img2.jpg");
    send session, EditProduct(1, "shoesX", 30);
    send session, DeleteProduct(2);
    send session, EditProduct(99, "fail", 0); // Should assert
    send session, DeleteProduct(99); // Should assert
    send session, GetProducts();
    send session, LogoutUser();
  }
}

//
// To run exhaustive testing:
//   pcc model.p && ptest model.dll
//
// P will report assertion failures, deadlocks, and property violations.