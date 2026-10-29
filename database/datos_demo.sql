-- =====================================================================
--  KING SCIARRA · Datos de demostración (usuarios y pedidos)
-- ---------------------------------------------------------------------
--  Llena la base para probar la app y el panel de administración:
--    - 13 usuarios @demo.kingsciarra.com (1 administradora y 12 clientes),
--      todos con la contraseña: clave123
--    - 49 pedidos de las últimas 3 semanas: los anteriores entregados y
--      los de hoy en todos los estados, con platos personalizados (extras,
--      ingredientes quitados y aclaraciones), bebidas y postres.
--
--  ANTES: ejecutá database/neon_setup.sql (o npm run db:seed) para cargar el menú.
--  Usalo en el SQL Editor de Neon o con: npm run db:demo
--
--  Se puede ejecutar varias veces: los usuarios no se duplican y los pedidos
--  solo se cargan si los usuarios de demostración todavía no tienen pedidos.
--  Las fechas son relativas al día en que se ejecuta.
--  Los precios se calculan igual que la API: precio del plato + extras.
--
--  Archivo generado: los pedidos salen del menú de database/seed.js.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Usuarios (password = hash de bcrypt de "clave123")
-- ---------------------------------------------------------------------
INSERT INTO Usuarios (nombre, apellido, email, password, admin)
VALUES
    ('Martina', 'Sciarra', 'martina.sciarra@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', TRUE ),
    ('Lucas', 'Fernández', 'lucas.fernandez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Valentina', 'Gómez', 'valentina.gomez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Santiago', 'Rodríguez', 'santiago.rodriguez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Camila', 'López', 'camila.lopez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Mateo', 'Martínez', 'mateo.martinez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Sofía', 'García', 'sofia.garcia@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Benjamín', 'Pérez', 'benjamin.perez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Julieta', 'Romero', 'julieta.romero@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Thiago', 'Díaz', 'thiago.diaz@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Catalina', 'Álvarez', 'catalina.alvarez@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Joaquín', 'Torres', 'joaquin.torres@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE),
    ('Emma', 'Ruiz', 'emma.ruiz@demo.kingsciarra.com', '$2b$10$uCqEKH1nyjiONgx7G3J29.ZZle13aGTwJrD0Ay8G3zUWlw8ksr3V6', FALSE)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Pedidos con sus ítems y personalizaciones
--    dias = hace cuántos días se hizo el pedido (0 = hoy)
-- ---------------------------------------------------------------------
DO $demo$
DECLARE
  datos jsonb := '[
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":20,"estado":"entregado","items":[{"plato":"La Bestia","cantidad":1},{"plato":"Veggie Garden","cantidad":1,"extras":{"Huevo frito":2}}]},
  {"email":"mateo.martinez@demo.kingsciarra.com","dias":19,"estado":"entregado","items":[{"plato":"Combo King","cantidad":1,"extras":{"Cheddar y verdeo en las papas":1}}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":19,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":1,"extras":{"Hongos salteados":2},"sin":["Tomate"]},{"plato":"Cerveza Artesanal IPA","cantidad":1}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":19,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":1,"aclaracion":"cortada al medio"},{"plato":"Limonada con Menta y Jengibre","cantidad":2}]},
  {"email":"emma.ruiz@demo.kingsciarra.com","dias":18,"estado":"entregado","items":[{"plato":"Combo Doble Bacon","cantidad":1},{"plato":"Azul y Hongos","cantidad":1},{"plato":"Churros con Dulce de Leche","cantidad":1}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":17,"estado":"entregado","items":[{"plato":"Crispy Chicken","cantidad":2},{"plato":"La Picante","cantidad":1,"extras":{"Cheddar":1,"Medallón de carne":1},"sin":["Jalapeños"]},{"plato":"Limonada con Menta y Jengibre","cantidad":1}]},
  {"email":"joaquin.torres@demo.kingsciarra.com","dias":17,"estado":"entregado","items":[{"plato":"Azul y Hongos","cantidad":1}]},
  {"email":"benjamin.perez@demo.kingsciarra.com","dias":16,"estado":"entregado","items":[{"plato":"La Argenta","cantidad":2},{"plato":"Brownie con Helado","cantidad":1,"extras":{"Crema batida":1},"sin":["Salsa de chocolate"]}]},
  {"email":"benjamin.perez@demo.kingsciarra.com","dias":16,"estado":"entregado","items":[{"plato":"Combo Familiar","cantidad":1,"extras":{"Panceta crocante":1,"Aros de cebolla":1}},{"plato":"Brownie con Helado","cantidad":1}]},
  {"email":"emma.ruiz@demo.kingsciarra.com","dias":15,"estado":"entregado","items":[{"plato":"Crispy Chicken","cantidad":1},{"plato":"Agua Mineral 500 ml","cantidad":1}]},
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":15,"estado":"entregado","items":[{"plato":"La King Sciarra","cantidad":2,"extras":{"Provoleta":1},"sin":["Cheddar"]},{"plato":"Azul y Hongos","cantidad":1},{"plato":"Gaseosa Lima-Limón 500 ml","cantidad":2}]},
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":14,"estado":"entregado","items":[{"plato":"La King Sciarra","cantidad":1,"extras":{"Salsa secreta":2}},{"plato":"Cheesecake de Frutos Rojos","cantidad":1,"extras":{"Crema batida":2}}]},
  {"email":"joaquin.torres@demo.kingsciarra.com","dias":14,"estado":"entregado","items":[{"plato":"Crispy Chicken","cantidad":1}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":14,"estado":"entregado","items":[{"plato":"Doble Cheddar Bacon","cantidad":1,"extras":{"Huevo frito":1}},{"plato":"Gaseosa Lima-Limón 500 ml","cantidad":1},{"plato":"Sundae de Dulce de Leche","cantidad":1}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":13,"estado":"entregado","items":[{"plato":"Combo King","cantidad":1},{"plato":"Doble Cheddar Bacon","cantidad":1,"extras":{"Cheddar":2}}]},
  {"email":"lucas.fernandez@demo.kingsciarra.com","dias":13,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":1},{"plato":"La Picante","cantidad":1,"aclaracion":"la salsa aparte"},{"plato":"Agua Mineral 500 ml","cantidad":2,"extras":{"Rodaja de limón":1}}]},
  {"email":"santiago.rodriguez@demo.kingsciarra.com","dias":13,"estado":"entregado","items":[{"plato":"Crispy Chicken","cantidad":1,"sin":["Lechuga"]},{"plato":"Doble Cheddar Bacon","cantidad":1},{"plato":"Gaseosa Cola 500 ml","cantidad":2}]},
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":12,"estado":"entregado","items":[{"plato":"La Argenta","cantidad":1,"extras":{"Palta":1,"Medallón de carne":2},"aclaracion":"cortada al medio"},{"plato":"Limonada con Menta y Jengibre","cantidad":1}]},
  {"email":"camila.lopez@demo.kingsciarra.com","dias":11,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":1},{"plato":"Limonada con Menta y Jengibre","cantidad":2}]},
  {"email":"santiago.rodriguez@demo.kingsciarra.com","dias":11,"estado":"entregado","items":[{"plato":"Doble Cheddar Bacon","cantidad":2},{"plato":"Limonada con Menta y Jengibre","cantidad":1}]},
  {"email":"benjamin.perez@demo.kingsciarra.com","dias":11,"estado":"entregado","items":[{"plato":"Crispy Chicken","cantidad":1,"extras":{"Cheddar":2},"sin":["Mayonesa de miel y mostaza"]}]},
  {"email":"lucas.fernandez@demo.kingsciarra.com","dias":10,"estado":"entregado","items":[{"plato":"Doble Cheddar Bacon","cantidad":1},{"plato":"Crispy Chicken","cantidad":2,"extras":{"Tomate":2},"sin":["Lechuga"]}]},
  {"email":"lucas.fernandez@demo.kingsciarra.com","dias":10,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":2},{"plato":"Crispy Chicken","cantidad":1},{"plato":"Cerveza Artesanal IPA","cantidad":1}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":10,"estado":"entregado","items":[{"plato":"Doble Cheddar Bacon","cantidad":1,"sin":["Panceta crocante"]},{"plato":"Agua Mineral 500 ml","cantidad":2}]},
  {"email":"catalina.alvarez@demo.kingsciarra.com","dias":9,"estado":"entregado","items":[{"plato":"Azul y Hongos","cantidad":1,"extras":{"Cebolla crispy":1,"Cebolla caramelizada":1},"sin":["Rúcula"]},{"plato":"Veggie Garden","cantidad":1,"extras":{"Cheddar":1,"Medallón de garbanzos":2},"aclaracion":"sin sal"},{"plato":"Sundae de Dulce de Leche","cantidad":1}]},
  {"email":"camila.lopez@demo.kingsciarra.com","dias":8,"estado":"entregado","items":[{"plato":"Combo Clásico","cantidad":1,"aclaracion":"tocar timbre 2B"},{"plato":"Doble Cheddar Bacon","cantidad":1,"sin":["Cebolla caramelizada"],"aclaracion":"jugosa por favor"}]},
  {"email":"emma.ruiz@demo.kingsciarra.com","dias":7,"estado":"entregado","items":[{"plato":"La Picante","cantidad":1,"extras":{"Pan sin TACC":1,"Palta":1},"aclaracion":"sin sal"},{"plato":"La King Sciarra","cantidad":1,"extras":{"Salsa barbacoa":2},"sin":["Salsa King"],"aclaracion":"sin sal"},{"plato":"Gaseosa Lima-Limón 500 ml","cantidad":1,"extras":{"Rodaja de limón":1}}]},
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":7,"estado":"entregado","items":[{"plato":"La Bestia","cantidad":2},{"plato":"Agua Mineral 500 ml","cantidad":1},{"plato":"Churros con Dulce de Leche","cantidad":1,"extras":{"Salsa de chocolate":2}}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":7,"estado":"entregado","items":[{"plato":"Doble Cheddar Bacon","cantidad":1,"sin":["Panceta crocante"]},{"plato":"La Argenta","cantidad":1},{"plato":"Brownie con Helado","cantidad":1}]},
  {"email":"benjamin.perez@demo.kingsciarra.com","dias":6,"estado":"entregado","items":[{"plato":"La Argenta","cantidad":1,"sin":["Provoleta"]},{"plato":"Doble Cheddar Bacon","cantidad":2}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":5,"estado":"entregado","items":[{"plato":"Combo King","cantidad":1}]},
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":5,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":1,"aclaracion":"tocar timbre 2B"},{"plato":"La Argenta","cantidad":1},{"plato":"Cerveza Artesanal IPA","cantidad":2,"extras":{"Rodaja de limón":1}}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":5,"estado":"entregado","items":[{"plato":"La Argenta","cantidad":1,"aclaracion":"sin sal"},{"plato":"Clásica King","cantidad":1},{"plato":"Gaseosa Lima-Limón 500 ml","cantidad":2}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":4,"estado":"entregado","items":[{"plato":"La Bestia","cantidad":1,"extras":{"Cebolla caramelizada":2},"aclaracion":"bien cocida"},{"plato":"Gaseosa Lima-Limón 500 ml","cantidad":2},{"plato":"Churros con Dulce de Leche","cantidad":1}]},
  {"email":"benjamin.perez@demo.kingsciarra.com","dias":4,"estado":"entregado","items":[{"plato":"La Bestia","cantidad":1,"extras":{"Medallón de carne":2,"Panceta crocante":1},"sin":["Salsa barbacoa"],"aclaracion":"bien cocida"}]},
  {"email":"lucas.fernandez@demo.kingsciarra.com","dias":3,"estado":"entregado","items":[{"plato":"La Bestia","cantidad":1,"extras":{"Panceta crocante":2},"sin":["Salsa barbacoa"]},{"plato":"Milkshake de Dulce de Leche","cantidad":1}]},
  {"email":"santiago.rodriguez@demo.kingsciarra.com","dias":3,"estado":"entregado","items":[{"plato":"Combo Doble Bacon","cantidad":1}]},
  {"email":"camila.lopez@demo.kingsciarra.com","dias":3,"estado":"entregado","items":[{"plato":"Combo King","cantidad":2},{"plato":"Pulled Pork BBQ","cantidad":1,"extras":{"Panceta crocante":1}}]},
  {"email":"camila.lopez@demo.kingsciarra.com","dias":2,"estado":"entregado","items":[{"plato":"Veggie Garden","cantidad":1,"sin":["Rúcula"]},{"plato":"Azul y Hongos","cantidad":1},{"plato":"Limonada con Menta y Jengibre","cantidad":1,"extras":{"Tamaño grande (1 L)":1},"aclaracion":"bien caliente"}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":1,"estado":"entregado","items":[{"plato":"La Picante","cantidad":1,"extras":{"Panceta crocante":2,"Tomate":2},"sin":["Pepper jack"]},{"plato":"La Bestia","cantidad":1}]},
  {"email":"mateo.martinez@demo.kingsciarra.com","dias":1,"estado":"entregado","items":[{"plato":"Combo King","cantidad":2,"extras":{"Agrandar bebida":1}},{"plato":"Doble Cheddar Bacon","cantidad":1}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":0,"estado":"entregado","items":[{"plato":"Doble Cheddar Bacon","cantidad":1}]},
  {"email":"valentina.gomez@demo.kingsciarra.com","dias":0,"estado":"entregado","items":[{"plato":"Azul y Hongos","cantidad":1,"extras":{"Cebolla crispy":1,"Pan sin TACC":1}},{"plato":"Cerveza Artesanal IPA","cantidad":2},{"plato":"Cheesecake de Frutos Rojos","cantidad":1}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":0,"estado":"en camino","items":[{"plato":"Combo Clásico","cantidad":1},{"plato":"La King Sciarra","cantidad":1}]},
  {"email":"joaquin.torres@demo.kingsciarra.com","dias":0,"estado":"aceptado","items":[{"plato":"Pulled Pork BBQ","cantidad":1,"extras":{"Cerdo desmechado":1},"sin":["Salsa barbacoa"]},{"plato":"La Bestia","cantidad":1,"sin":["Huevo frito"]}]},
  {"email":"thiago.diaz@demo.kingsciarra.com","dias":0,"estado":"aceptado","items":[{"plato":"Pulled Pork BBQ","cantidad":1,"aclaracion":"cortada al medio"},{"plato":"La Picante","cantidad":2}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":0,"estado":"pendiente","items":[{"plato":"Doble Cheddar Bacon","cantidad":1},{"plato":"Clásica King","cantidad":1},{"plato":"Gaseosa Lima-Limón 500 ml","cantidad":2},{"plato":"Brownie con Helado","cantidad":1,"extras":{"Dulce de leche":1}}]},
  {"email":"sofia.garcia@demo.kingsciarra.com","dias":0,"estado":"pendiente","items":[{"plato":"Crispy Chicken","cantidad":1},{"plato":"Gaseosa Cola 500 ml","cantidad":2}]},
  {"email":"joaquin.torres@demo.kingsciarra.com","dias":0,"estado":"pendiente","items":[{"plato":"La Bestia","cantidad":2},{"plato":"Pulled Pork BBQ","cantidad":1,"sin":["Coleslaw"]}]}
]';
  pedido jsonb;
  item jsonb;
  v_usuario integer;
  v_pedido integer;
  v_item integer;
  v_plato record;
  v_precio integer;
  v_items integer;
  v_total integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM Ingredientes) OR NOT EXISTS (SELECT 1 FROM Platos WHERE tipo = 'bebida') THEN
    RAISE EXCEPTION 'Falta el menú: ejecutá primero database/neon_setup.sql (o npm run db:seed)';
  END IF;

  IF EXISTS (SELECT 1 FROM Pedidos p JOIN Usuarios u ON u.id = p.id_usuario
              WHERE u.email LIKE '%@demo.kingsciarra.com') THEN
    RAISE NOTICE 'Los pedidos de demostración ya estaban cargados: no se insertó ninguno.';
    RETURN;
  END IF;

  FOR pedido IN SELECT value FROM jsonb_array_elements(datos) LOOP
    SELECT id INTO v_usuario FROM Usuarios WHERE email = pedido->>'email';
    CONTINUE WHEN v_usuario IS NULL;

    INSERT INTO Pedidos (id_usuario, fecha, estado)
    VALUES (v_usuario,
            (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - (pedido->>'dias')::int,
            pedido->>'estado')
    RETURNING id INTO v_pedido;
    v_items := 0;

    FOR item IN SELECT value FROM jsonb_array_elements(pedido->'items') LOOP
      -- Si un administrador renombró o borró el plato, el ítem se omite
      SELECT id, precio INTO v_plato FROM Platos WHERE LOWER(nombre) = LOWER(item->>'plato');
      CONTINUE WHEN NOT FOUND;

      -- Precio unitario = precio del plato + extras que el plato admite (hasta su máximo)
      SELECT v_plato.precio + COALESCE(SUM(i.precio * LEAST(e.value::int, x.maximo)), 0) INTO v_precio
        FROM jsonb_each_text(COALESCE(item->'extras', '{}'::jsonb)) e
        JOIN Ingredientes i ON LOWER(i.nombre) = LOWER(e.key)
        JOIN IngredientesXPlatos x ON x.id_ingrediente = i.id AND x.id_plato = v_plato.id AND x.maximo > 0;

      INSERT INTO PlatosXPedidos (id_pedido, id_plato, cantidad, precio_unitario, aclaracion)
      VALUES (v_pedido, v_plato.id, (item->>'cantidad')::int, v_precio, item->>'aclaracion')
      RETURNING id INTO v_item;
      v_items := v_items + 1;

      INSERT INTO Personalizaciones (id_item, id_ingrediente, accion, cantidad, precio)
      SELECT v_item, i.id, 'agregar', LEAST(e.value::int, x.maximo), i.precio
        FROM jsonb_each_text(COALESCE(item->'extras', '{}'::jsonb)) e
        JOIN Ingredientes i ON LOWER(i.nombre) = LOWER(e.key)
        JOIN IngredientesXPlatos x ON x.id_ingrediente = i.id AND x.id_plato = v_plato.id AND x.maximo > 0;

      INSERT INTO Personalizaciones (id_item, id_ingrediente, accion, cantidad, precio)
      SELECT v_item, i.id, 'quitar', 1, 0
        FROM jsonb_array_elements_text(COALESCE(item->'sin', '[]'::jsonb)) s
        JOIN Ingredientes i ON LOWER(i.nombre) = LOWER(s.value)
        JOIN IngredientesXPlatos x ON x.id_ingrediente = i.id AND x.id_plato = v_plato.id AND x.incluido
      ON CONFLICT DO NOTHING;
    END LOOP;

    IF v_items = 0 THEN
      DELETE FROM Pedidos WHERE id = v_pedido;
    ELSE
      v_total := v_total + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Se cargaron % pedidos de demostración.', v_total;
END
$demo$;

COMMIT;

-- ---------------------------------------------------------------------
-- Comprobación: pedidos de demostración por estado
-- ---------------------------------------------------------------------
SELECT p.estado, COUNT(*) AS pedidos
  FROM Pedidos p
  JOIN Usuarios u ON u.id = p.id_usuario
 WHERE u.email LIKE '%@demo.kingsciarra.com'
 GROUP BY p.estado
 ORDER BY p.estado;
