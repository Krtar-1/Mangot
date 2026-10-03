# Mangot - Book Collection App

A personal library application to manage your book collection.

**Name Origin:** Play on "Manga" and "got" as in "I got it".

## Features

- Register books to your collection
- Mark books as read or unread
- Search for books in your collection
- Organize books into collections/series
- Login/signup with account settings
- Edit previously added books
- Comment on collected items
- **Import books from Open Library API**
- **Browse other collectors' collections**
- **Guest view (no account needed)**

## Tech Stack

- HTML, CSS, JavaScript
- Firebase Auth & Firestore
- Open Library API
- Claude Code AI (development assistant)

---

## Book Import Feature

### What It Does

The Import Book feature allows you to quickly add books to your collection by searching an online database instead of manually entering all the details.

### API Used

**Open Library API** (https://openlibrary.org)

- Free to use, no API key required
- Large database of books
- Provides book covers, authors, publication dates, and categories

### How to Use

1. Go to the **Add Book** page (Register Book)
2. Click the **"Import Book"** button at the top of the form
3. In the search modal, type a **book title** or **ISBN**
4. Click **Search** or press Enter
5. Browse the results showing book covers, titles, authors, and publication years
6. Click on a book to select it
7. The form will auto-fill with:
   - Title
   - Author
   - Cover image
   - Genres (mapped from Open Library categories)
8. Review the imported data, make any edits if needed
9. Click **"Add to Collection"** to save

### Example Searches

- Search by title: `Harry Potter`, `The Great Gatsby`, `1984`
- Search by ISBN: `9780439139601`, `978-0-06-112008-4`

---

## Collectors Page

The **Collectors** page (`users.html`) lets you find other users and browse their collections.

- Opens on a list of user names (Krtar first, then the largest collections), with a search box to filter by name
- Click a name to see that user's collection, grouped by series
- Series start collapsed - click a series to open it, which keeps large collections easy to navigate
- Finished series show progress as owned/total (e.g. `30/34 books`), in green once complete
- Search within a user's collection by title, author, genre, or series
- Links are shareable: `users.html?user=<id>` opens straight to that user

### Next to Get

At the top of each user's collection, **Next to Get** shows 5 random books they are missing. Books come from series that are marked Finished but not fully collected, and titles follow the series' auto-naming template (e.g. `Attack on Titan Vol. 31`). Click **Shuffle** for a new pick.

User settings are private, so each series' total and naming template are copied onto its books (`seriesTotal`, `seriesNamingTemplate`). This happens automatically when the owner opens My Collection or saves series settings.

## Guest View

On the login page, **Continue as Guest** lets people browse Mangot without an account.

- Guests can view Home, Search, and Collectors, and read comments
- Guests cannot add books, comment, or open My Collection, Profile, or Settings (they're sent back to Collectors)
- The nav shows a **Guest** badge; signing in or signing up ends guest mode

---

## Known Bugs

- Fixed: Search not working (Firestore authentication error)
- Fixed: Bio text on profile not properly aligned
- Open: Users can upload without a username, showing "uploaded by unknown" in search results

## What I Learned

AI can get a lot done for you, but there are still lots of parts you need manual input for, such as backend services and fine tuning. Claude can still get a very strong foundation to work on, and with enough time and working alongside Claude (or any AI) you can make genuinely good websites with less effort than manual coding. I do know this does not replace the need for coding education, as knowing how bugs are formed and how bugs can be solved is something that can be helped by Claude, but a fundamental understanding of how and why a certain problem happens will help far more with debugging (as well as other aspects of coding).
