/* =========================================================
   Supabase-only data layer
   Supabase is the sole persistence source; no localStorage fallback.
   ========================================================= */
(function () {
  const SUPABASE_URL = "https://zwxnmnfoknfbzvptnpmv.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A6u5kWAdL60bYpz1wRyv6w_J2p896iY";

  let sb = null;

  function initSupabasePatients() {
    if (!window.supabase || sb) return sb;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return sb;
  }

  async function currentUser() {
    const client = initSupabasePatients();
    if (!client) return null;

    const { data, error } = await client.auth.getUser();
    if (error) return null;

    return data?.user || null;
  }

  function normalizePatient(p) {
    return {
      id: p.id,
      name: p.name || "",
      gender: p.gender ?? "",
      birth_date: p.birth_date ?? null,
      age: p.age ?? null,
      height: p.height ?? null,
      diagnosis: p.diagnosis ?? "",
      complaints: p.complaints ?? "",
      clinical_notes: p.clinical_notes ?? "",
      created_at: p.created_at,
      updated_at: p.updated_at
    };
  }

  async function loadPatientsFromSupabase() {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user) return null;

    const { data, error } = await client
      .from("patients")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.warn("Supabase patients load:", error.message);
      return null;
    }

    const profiles = (data || []).map(normalizePatient);

    if (typeof window.patientProfiles !== "undefined") {
      window.patientProfiles = profiles;
    }

    if (typeof window.renderPatientsList === "function") {
      window.renderPatientsList();
    }

    return profiles;
  }

  async function createPatientInSupabase(patient) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user) return null;

    const payload = {
      user_id: user.id,
      name: patient.name || "مريض",
      gender: patient.gender || null,
      birth_date: patient.birth_date || null,
      age:
        patient.age !== "" && patient.age != null
          ? Number(patient.age)
          : null,
      height:
        patient.height !== "" && patient.height != null
          ? Number(patient.height)
          : null,
      diagnosis: patient.diagnosis || null,
      complaints: patient.complaints || null,
      clinical_notes: patient.clinical_notes || null
    };

    const { data, error } = await client
      .from("patients")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.warn("Supabase patient insert:", error.message);
      return null;
    }

    return normalizePatient(data);
  }

  async function updatePatientInSupabase(patientId, patient) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !patientId) return false;

    const payload = {
      name: patient.name || "مريض",
      gender: patient.gender || null,
      birth_date: patient.birth_date || null,
      age:
        patient.age !== "" && patient.age != null
          ? Number(patient.age)
          : null,
      height:
        patient.height !== "" && patient.height != null
          ? Number(patient.height)
          : null,
      diagnosis: patient.diagnosis || null,
      complaints: patient.complaints || null,
      clinical_notes: patient.clinical_notes || null
    };

    const { error } = await client
      .from("patients")
      .update(payload)
      .eq("id", patientId)
      .eq("user_id", user.id);

    if (error) {
      console.warn("Supabase patient update:", error.message);
      return false;
    }

    return true;
  }

  async function deletePatientFromSupabase(patientId) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !patientId) return false;

    const { error } = await client
      .from("patients")
      .delete()
      .eq("id", patientId)
      .eq("user_id", user.id);

    if (error) {
      console.warn("Supabase patient delete:", error.message);
      return false;
    }

    return true;
  }

  async function loadWeightsFromSupabase(patientId) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !patientId) return null;

    const { data, error } = await client
      .from("weight_logs")
      .select(
        "id, patient_id, weight, measurement_date, notes, created_at"
      )
      .eq("patient_id", patientId)
      .order("measurement_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Supabase weight load:", error.message);
      return null;
    }

    return (data || []).map(w => ({
      id: w.id,
      date: w.measurement_date,
      weight: Number(w.weight),
      notes: w.notes || ""
    }));
  }

  async function addWeightToSupabase(patientId, entry) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !patientId) return null;

    const { data: patient, error: pError } = await client
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (pError || !patient) return null;

    const { data, error } = await client
      .from("weight_logs")
      .insert({
        patient_id: patientId,
        weight: Number(entry.weight),
        measurement_date: entry.date,
        notes: entry.notes || null
      })
      .select(
        "id, patient_id, weight, measurement_date, notes, created_at"
      )
      .single();

    if (error) {
      console.warn("Supabase weight insert:", error.message);
      return null;
    }

    return {
      id: data.id,
      date: data.measurement_date,
      weight: Number(data.weight),
      notes: data.notes || ""
    };
  }

  async function deleteWeightFromSupabase(weightId, patientId) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !weightId || !patientId) return false;

    const { error } = await client
      .from("weight_logs")
      .delete()
      .eq("id", weightId)
      .eq("patient_id", patientId);

    if (error) {
      console.warn("Supabase weight delete:", error.message);
      return false;
    }

    return true;
  }

  async function loadFoodsFromSupabase() {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user) return null;

    const { data, error } = await client
      .from("foods")
      .select("*")
      .order("name_ar", { ascending: true });

    if (error) {
      console.warn("Supabase foods load:", error.message);
      return null;
    }

    const foods = (data || []).map(f => ({
      id: String(f.id),
      name: f.name_ar || "",
      arabicName: f.name_ar || "",
      englishName: f.name_en || "",
      household: f.household || "",
      calories: Number(f.kcal || 0),
      kcal: Number(f.kcal || 0),
      protein: Number(f.protein || 0),
      carbs: Number(f.carb || 0),
      carb: Number(f.carb || 0),
      fat: Number(f.fat || 0),
      sodium: Number(f.sodium || 0),
      potassium: Number(f.potassium || 0),
      phosphorus: Number(f.phosphorus || 0),
      water: Number(f.water || 0),
      isCustom: Boolean(f.is_custom),
      createdBy: f.created_by || null
    }));

    foodDatabase = foods;

    customFoods = foods.filter(
      f => f.isCustom && f.createdBy === user.id
    );

    libraryReady = foodDatabase.length > 0;

    if (typeof window.foodDatabase !== "undefined") {
      window.foodDatabase = foodDatabase;
    }

    if (typeof window.customFoods !== "undefined") {
      window.customFoods = customFoods;
    }

    return foods;
  }

  function foodPayload(food, userId) {
    return {
      name_ar: food.name || food.arabicName || "",
      name_en: food.englishName || "",
      kcal: Number(food.calories ?? food.kcal ?? 0),
      protein: Number(food.protein ?? 0),
      carb: Number(food.carbs ?? food.carb ?? 0),
      fat: Number(food.fat ?? 0),
      sodium: Number(food.sodium ?? 0),
      potassium: Number(food.potassium ?? 0),
      phosphorus: Number(food.phosphorus ?? 0),
      water: Number(food.water ?? 0),
      household: food.household || "",
      is_custom: true,
      created_by: userId
    };
  }

  async function createFoodInSupabase(food) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user) return null;

    const generatedId =
      "food_custom_" +
      (window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2));

    const payload = {
      id: generatedId,
      ...foodPayload(food, user.id)
    };

    const { data, error } = await client
      .from("foods")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.warn("Supabase food insert:", error.message);
      return null;
    }

    return data;
  }

  async function updateFoodInSupabase(foodId, food) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !foodId) return false;

    const { error } = await client
      .from("foods")
      .update(foodPayload(food, user.id))
      .eq("id", foodId)
      .eq("created_by", user.id)
      .eq("is_custom", true);

    if (error) {
      console.warn("Supabase food update:", error.message);
      return false;
    }

    return true;
  }

  async function deleteFoodFromSupabase(foodId) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !foodId) return false;

    const { error } = await client
      .from("foods")
      .delete()
      .eq("id", foodId)
      .eq("created_by", user.id)
      .eq("is_custom", true);

    if (error) {
      console.warn("Supabase food delete:", error.message);
      return false;
    }

    return true;
  }

  function scaleHouseholdMeasure(measure, grams) {
    if (!measure || !grams) return measure || "";

    const match = String(measure).match(
      /^([\d.]+)\s*(.*)$/
    );

    if (!match) return measure;

    const baseValue = Number(match[1]);
    const unit = match[2];

    if (!Number.isFinite(baseValue) || baseValue <= 0) {
      return measure;
    }

    return `${Math.round(baseValue * grams / 100 * 100) / 100} ${unit}`;
  }

  function normalizedPlanItem(item, food) {
    return {
      quantity_g: Number(item.grams) || 0,
      household_measure: food?.household
        ? scaleHouseholdMeasure(
            food.household,
            Number(item.grams) || 0
          )
        : null,
      frequency:
        item.repeat ??
        (item.repeatDays !== undefined
          ? `7/${item.repeatDays}`
          : null)
    };
  }

  function planPayload(patientId, planId) {
    return {
      id: planId,
      patient_id: patientId,
      target_calories:
        Number(patientInfo?.targetCal) || null,
      target_protein:
        Number(patientInfo?.targetPro) || null,
      target_carb:
        Number(patientInfo?.targetCarb) || null,
      target_fat:
        Number(patientInfo?.targetFat) || null,
      goal: patientInfo?.goal || null
    };
  }

  async function loadNutritionPlanFromSupabase(patientId) {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !patientId) return null;

    const {
      data: plans,
      error: pError
    } = await client
      .from("nutrition_plans")
      .select("*")
      .eq("patient_id", patientId)
      .order("updated_at", {
        ascending: false
      })
      .order("created_at", {
        ascending: false
      })
      .limit(1);

    if (pError) {
      console.warn(
        "Supabase nutrition plan load:",
        pError.message
      );
      return null;
    }

    const plan = plans?.[0];

    if (!plan) return null;

    const {
      data: dayRows,
      error: dError
    } = await client
      .from("plan_days")
      .select("*")
      .eq("plan_id", plan.id)
      .order("day_number", {
        ascending: true
      });

    if (dError) {
      console.warn(
        "Supabase plan days load:",
        dError.message
      );
      return null;
    }

    const dayIds = (dayRows || []).map(d => d.id);

    let mealRows = [];

    if (dayIds.length) {
      const {
        data,
        error
      } = await client
        .from("plan_meals")
        .select("*")
        .in("day_id", dayIds)
        .order("meal_order", {
          ascending: true
        });

      if (error) {
        console.warn(
          "Supabase plan meals load:",
          error.message
        );
        return null;
      }

      mealRows = data || [];
    }

    const mealIds = mealRows.map(m => m.id);

    let itemRows = [];

    if (mealIds.length) {
      const {
        data,
        error
      } = await client
        .from("plan_items")
        .select("*")
        .in("meal_id", mealIds);

      if (error) {
        console.warn(
          "Supabase plan items load:",
          error.message
        );
        return null;
      }

      itemRows = data || [];
    }

    const mealsByDay = {};

    mealRows.forEach(m => {
      (mealsByDay[m.day_id] ||= []).push(m);
    });

    const itemsByMeal = {};

    itemRows.forEach(i => {
      (itemsByMeal[i.meal_id] ||= []).push(i);
    });

    const days = (dayRows || []).map(d => ({
      id: d.id,
      title:
        d.day_name ||
        `اليوم ${d.day_number}`,
      notes: "",
      isCollapsed: false,
      meals: (mealsByDay[d.id] || []).map(m => ({
        id: m.id,
        name: m.meal_name || "وجبة",
        description: "",
        items: (itemsByMeal[m.id] || []).map(i => ({
          itemId: i.id,
          foodId: i.food_id,
          grams: Number(i.quantity_g) || 0,
          includeInCalculation: true,
          ...(i.frequency != null
            ? { repeat: i.frequency }
            : {})
        }))
      }))
    }));

    return {
      plan,
      days
    };
  }

  function newCloudUuid() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = Math.random() * 16 | 0;
        const v =
          c === "x"
            ? r
            : (r & 0x3) | 0x8;

        return v.toString(16);
      }
    );
  }

  async function saveNutritionPlanToSupabase() {
    const client = initSupabasePatients();
    const user = await currentUser();

    if (!client || !user || !activePatientId) {
      return false;
    }

    try {
      const localDays = Array.isArray(savedDaysData)
        ? savedDaysData
        : Array.isArray(daysData)
        ? daysData
        : [];

      const missingFoods = [];

      localDays.forEach(day =>
        (day.meals || []).forEach(meal =>
          (meal.items || []).forEach(item => {
            if (!item.foodId) return;

            const exists = foodDatabase.some(
              f =>
                String(f.id) ===
                String(item.foodId)
            );

            if (!exists) {
              missingFoods.push(
                String(item.foodId)
              );
            }
          })
        )
      );

      if (missingFoods.length) {
        throw new Error(
          "الصنف غير موجود في مكتبة الأغذية: " +
          [...new Set(missingFoods)].join(", ")
        );
      }

      let planId = activeCloudPlanId;

      if (!planId) {
        const {
          data: existing,
          error
        } = await client
          .from("nutrition_plans")
          .select("id")
          .eq("patient_id", activePatientId)
          .order("updated_at", {
            ascending: false
          })
          .order("created_at", {
            ascending: false
          })
          .limit(1);

        if (error) {
          throw new Error(
            "فشل البحث عن الخطة: " +
            error.message
          );
        }

        planId =
          existing?.[0]?.id ||
          newCloudUuid();
      }

      const planData =
        planPayload(
          activePatientId,
          planId
        );

      const {
        error: planError
      } = await client
        .from("nutrition_plans")
        .upsert(planData, {
          onConflict: "id"
        });

      if (planError) {
        throw new Error(
          "فشل حفظ الخطة: " +
          planError.message
        );
      }

      activeCloudPlanId = planId;

      const {
        data: oldDays,
        error: oldDaysError
      } = await client
        .from("plan_days")
        .select("id")
        .eq("plan_id", planId);

      if (oldDaysError) {
        throw new Error(
          "فشل قراءة أيام الخطة القديمة: " +
          oldDaysError.message
        );
      }

      const oldDayIds =
        (oldDays || []).map(x => x.id);

      if (oldDayIds.length) {
        const {
          data: oldMeals,
          error: oldMealsError
        } = await client
          .from("plan_meals")
          .select("id")
          .in("day_id", oldDayIds);

        if (oldMealsError) {
          throw new Error(
            "فشل قراءة وجبات الخطة القديمة: " +
            oldMealsError.message
          );
        }

        const oldMealIds =
          (oldMeals || []).map(
            x => x.id
          );

        if (oldMealIds.length) {
          const {
            error
          } = await client
            .from("plan_items")
            .delete()
            .in(
              "meal_id",
              oldMealIds
            );

          if (error) {
            throw new Error(
              "فشل حذف أصناف الخطة القديمة: " +
              error.message
            );
          }

          const {
            error: mealDeleteError
          } = await client
            .from("plan_meals")
            .delete()
            .in(
              "day_id",
              oldDayIds
            );

          if (mealDeleteError) {
            throw new Error(
              "فشل حذف وجبات الخطة القديمة: " +
              mealDeleteError.message
            );
          }
        }

        const {
          error: dayDeleteError
        } = await client
          .from("plan_days")
          .delete()
          .eq("plan_id", planId);

        if (dayDeleteError) {
          throw new Error(
            "فشل حذف أيام الخطة القديمة: " +
            dayDeleteError.message
          );
        }
      }

      if (!localDays.length) {
        return true;
      }

      const dayRows = localDays.map(
        (d, idx) => ({
          id: newCloudUuid(),
          plan_id: planId,
          day_number: idx + 1,
          day_name:
            d.title ||
            `اليوم ${idx + 1}`
        })
      );

      const {
        error: daysError
      } = await client
        .from("plan_days")
        .insert(dayRows);

      if (daysError) {
        throw new Error(
          "فشل حفظ الأيام: " +
          daysError.message
        );
      }

      const mealRows = [];

      localDays.forEach(
        (day, di) => {
          const cloudDay =
            dayRows[di];

          (day.meals || []).forEach(
            (meal, mi) => {
              mealRows.push({
                id: newCloudUuid(),
                day_id:
                  cloudDay.id,
                meal_name:
                  meal.name ||
                  `وجبة ${mi + 1}`,
                meal_order:
                  mi + 1
              });
            }
          );
        }
      );

      if (!mealRows.length) {
        return true;
      }

      const {
        error: mealsError
      } = await client
        .from("plan_meals")
        .insert(mealRows);

      if (mealsError) {
        throw new Error(
          "فشل حفظ الوجبات: " +
          mealsError.message
        );
      }

      const itemPayload = [];

      localDays.forEach(
        (day, di) => {
          const cloudDay =
            dayRows[di];

          (day.meals || []).forEach(
            (meal, mi) => {
              const cloudMeal =
                mealRows.find(
                  m =>
                    m.day_id ===
                      cloudDay.id &&
                    m.meal_order ===
                      mi + 1
                );

              if (!cloudMeal) return;

              (meal.items || []).forEach(
                item => {
                  if (!item.foodId) {
                    return;
                  }

                  const food =
                    foodDatabase.find(
                      f =>
                        String(f.id) ===
                        String(item.foodId)
                    );

                  const normalized =
                    normalizedPlanItem(
                      item,
                      food
                    );

                  itemPayload.push({
                    id:
                      item.itemId &&
                      String(
                        item.itemId
                      ).trim()
                        ? String(
                            item.itemId
                          )
                        : newCloudUuid(),
                    meal_id:
                      cloudMeal.id,
                    food_id:
                      String(
                        item.foodId
                      ),
                    quantity_g:
                      normalized.quantity_g,
                    household_measure:
                      normalized.household_measure,
                    frequency:
                      normalized.frequency
                  });
                }
              );
            }
          );
        }
      );

      if (itemPayload.length) {
        const {
          error: itemsError
        } = await client
          .from("plan_items")
          .insert(itemPayload);

        if (itemsError) {
          throw new Error(
            "فشل حفظ أصناف الخطة: " +
            itemsError.message
          );
        }
      }

      return true;

    } catch (e) {
      console.error(
        "Supabase nutrition plan save:",
        e
      );

      window.__lastNutritionPlanSaveError =
        e?.message ||
        String(e);

      return false;
    }
  }

  function scheduleNutritionPlanSave() {
    if (!activePatientId) return;

    clearTimeout(
      cloudPlanSaveTimer
    );

    cloudPlanSaveTimer =
      setTimeout(async () => {
        const ok =
          await saveNutritionPlanToSupabase();

        if (
          !ok &&
          typeof showToast ===
            "function"
        ) {
          const msg =
            window.__lastNutritionPlanSaveError;

          showToast(
            msg
              ? "فشل حفظ الخطة: " + msg
              : "تعذر مزامنة الخطة مع قاعدة البيانات",
            "error"
          );
        }
      }, 900);
  }

  /*
   * Public helpers for the existing app.
   * Supabase is the sole persistence layer.
   */
  window.DietPlannerPatientDB = {
    init: initSupabasePatients,
    load: loadPatientsFromSupabase,
    create: createPatientInSupabase,
    update: updatePatientInSupabase,
    remove: deletePatientFromSupabase,

    loadWeights:
      loadWeightsFromSupabase,
    addWeight:
      addWeightToSupabase,
    removeWeight:
      deleteWeightFromSupabase,

    loadFoods:
      loadFoodsFromSupabase,
    createFood:
      createFoodInSupabase,
    updateFood:
      updateFoodInSupabase,
    removeFood:
      deleteFoodFromSupabase,

    loadPlan:
      loadNutritionPlanFromSupabase,
    savePlan:
      saveNutritionPlanToSupabase,
    schedulePlanSave:
      scheduleNutritionPlanSave
  };

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      setTimeout(
        async function () {
          const patients =
            await loadPatientsFromSupabase();

          if (Array.isArray(patients)) {
            patientProfiles =
              patients;
          }

          const foods =
            await loadFoodsFromSupabase();

          if (Array.isArray(foods)) {
            foodDatabase =
              foods;
          }

          rebuildFoodDatabase();
          updateDatabaseStatusText();

          if (
            typeof renderDatabaseTabTable ===
            "function"
          ) {
            renderDatabaseTabTable();
          }

          renderPatientsList();
        },
        700
      );
    }
  );
})();
