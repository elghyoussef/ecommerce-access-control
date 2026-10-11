// Product management routes
module.exports = function(app, queryPromise, isAuthenticated, isAdmin, multer, path) {
  // Multer storage config to keep original extension
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
      cb(null, uniqueName);
    }
  });
  const upload = multer({ storage });

  // Supprimer un produit (admin seulement)
  app.post('/delete-product', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.body;
    try {
      await queryPromise('DELETE FROM products WHERE id = ?', [id]);
      res.send("<script>alert('Produit supprimé avec succès'); window.location.href = '/shop';</script>");
    } catch (err) {
      console.error(err);
      res.status(500).send("<script>alert('Erreur lors de la suppression du produit'); window.location.href = '/shop';</script>");
    }
  });

  // Modifier un produit (admin seulement)
  app.post('/edit-product', upload.single('imgsrc'), isAuthenticated, isAdmin, async (req, res) => {
    const { id, name, price } = req.body;
    try {
      let imgsrc;
      if (req.file) {
        imgsrc = '/uploads/' + req.file.filename;
        await queryPromise('UPDATE products SET name = ?, price = ?, imgsrc = ? WHERE id = ?', [name, price, imgsrc, id]);
      } else {
        await queryPromise('UPDATE products SET name = ?, price = ? WHERE id = ?', [name, price, id]);
      }
      res.send("<script>alert('Produit modifié avec succès'); window.location.href = '/shop';</script>");
    } catch (err) {
      console.error(err);
      res.status(500).send("<script>alert('Erreur lors de la modification du produit'); window.location.href = '/shop';</script>");
    }
  });

  app.post('/submit', isAuthenticated, isAdmin, upload.single('imgsrc'), (req, res) => {
    const { name, price } = req.body;
    // Save only the relative path for the image
    const imgsrc = '/uploads/' + req.file.filename;
    const sql = 'INSERT INTO products (name, price, imgsrc) VALUES (?, ?, ?)';
    queryPromise(sql, [name, price, imgsrc])
      .then(result => {
        console.log('Produit ajouté:', result);
        res.redirect('/admin');
      })
      .catch(err => {
        console.error(err);
        res.status(500).send('Erreur lors de l\'ajout du produit');
      });
  });  // API products
  app.get('/api/products', async (req, res) => {
    console.log("Fetching products...");
    try {
      // Use a simpler query to test if the database is working at all
      const testQuery = 'SHOW TABLES';
      const tables = await queryPromise(testQuery);
      
      // If we get here, the database is working, proceed with products query
      const query = 'SELECT * FROM products';
      const results = await queryPromise(query);
      
      if (!results || results.length === 0) {
        console.log("No products found, sending empty array");
        return res.status(200).json([]);
      }
      
      // Just send the results directly, our utils.js now returns them correctly
      res.status(200).json(results);
    } catch (err) {
      console.error("Error fetching products:", err);
      res.status(500).json({ error: 'Erreur lors de la récupération des produits', details: err.message });
    }
  });
};
